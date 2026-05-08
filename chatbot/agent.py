"""
agent.py — LangChain Agent sử dụng OpenAI/Google LLM.
"""
import os
import json
import asyncio
import logging
import datetime
from dotenv import load_dotenv

from langchain_classic.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from prompts import SYSTEM_PROMPT
from tools import ALL_TOOLS
from session_store import get_chat_history, save_interaction, pop_ui_actions
from tools.context import current_user_id, current_session_key

load_dotenv()
logger = logging.getLogger(__name__)

# Khởi tạo model
llm_provider = os.getenv("LLM_PROVIDER", "openai").lower()
llm = None

try:
    if llm_provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        google_api_key = os.getenv("GOOGLE_API_KEY")
        google_model_name = os.getenv("GOOGLE_MODEL", "gemini-1.5-flash")
        
        if not google_api_key:
             logger.warning("GOOGLE_API_KEY chưa được thiết lập!")
             llm = None
        else:
             llm = ChatGoogleGenerativeAI(
                 model=google_model_name,
                 google_api_key=google_api_key,
                 temperature=0.3,
                 timeout=60,
             )
    else:
        # Mặc định dùng OpenAI (Loại bỏ Ollama vì hiệu năng thấp)
        from langchain_openai import ChatOpenAI
        openai_api_key = os.getenv("OPENAI_API_KEY")
        openai_model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        
        if not openai_api_key:
             logger.error("OPENAI_API_KEY chưa được thiết lập! Chatbot sẽ không hoạt động.")
             llm = None
        else:
             llm = ChatOpenAI(
                 model=openai_model_name,
                 api_key=openai_api_key,
                 temperature=0.3,
                 timeout=60,
                 streaming=True,
             )

except Exception as e:
    logger.error(f"Lỗi khởi tạo LLM ({llm_provider}): {e}")
    llm = None


# Tạo prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT + "\n\nThông tin hệ thống:\n- Ngày giờ hiện tại: {current_date}\n- Ngữ cảnh người dùng: {user_context_info}"),
    MessagesPlaceholder(variable_name="chat_history"),
    ("user", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Build agent executor
if llm:
    agent = create_tool_calling_agent(llm, ALL_TOOLS, prompt)
    agent_executor = AgentExecutor(
        agent=agent,
        tools=ALL_TOOLS,
        verbose=True,
        handle_parsing_errors=True,
        max_iterations=10,
        return_intermediate_steps=True,
        stream_runnable=True,
    )
else:
    agent_executor = None


def parse_tool_result_marker(response_text: str) -> tuple[str, dict, str]:
    """
    Tìm marker __TOOL_RESULT__: {"action": "...", "data": {...}} trong response.
    Nếu có, trả về (action, data, msg) và xóa phần marker khỏi câu trả lời.
    Nếu không có, trả về (action, data, msg)
    """
    if "__TOOL_RESULT__:" not in response_text:
        return "SHOW_INFO", {}, response_text

    try:
        parts = response_text.split("__TOOL_RESULT__:")
        msg = parts[0].strip()
        data_json = parts[1].strip()
        
        # Tìm vị trí bắt đầu của JSON
        start_idx = data_json.find('{')
        if start_idx != -1:
            json_content = data_json[start_idx:]
            # Sử dụng raw_decode để trích xuất đúng 1 object JSON hợp lệ đầu tiên
            import json
            decoder = json.JSONDecoder()
            data, _ = decoder.raw_decode(json_content)
            return data.get("action", "SHOW_INFO"), data.get("data", {}), msg
    except Exception as e:
        logger.error(f"Lỗi parse tool marker: {e}")
    
    return "SHOW_INFO", {}, response_text.replace("__TOOL_RESULT__:", "")


def chat_with_agent(message: str, session_key: str, user_id: int | str | None = None, user_context_info: str = "Chưa có thông tin") -> tuple[str, str, dict]:
    if not agent_executor:
        return "Lỗi: LLM Agent chưa được cấu hình.", "SHOW_INFO", {}

    # Khởi tạo ngữ cảnh cho request
    current_user_id.set(user_id)
    current_session_key.set(session_key)

    chat_history = get_chat_history(session_key)
    
    try:
        response = agent_executor.invoke({
            "input": message,
            "chat_history": chat_history,
            "current_date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M (%A)"),
            "user_context_info": user_context_info
        })
        
        raw_output = response.get("output", "")
        # Nếu output là list (đôi khi xảy ra với một số model)
        if isinstance(raw_output, list):
            text_parts = []
            for part in raw_output:
                if isinstance(part, dict):
                    text_parts.append(part.get("text", ""))
                elif isinstance(part, str):
                    text_parts.append(part)
            raw_output = "".join(text_parts).strip()

        # 2. Lấy action/data từ cache (session_store)
        final_action = "SHOW_INFO"
        final_data = {}
        tool_actions = pop_ui_actions(session_key)
        if tool_actions:
            # Lấy action cuối cùng được gọi
            last_tool = tool_actions[-1]
            final_action = last_tool["action"]
            final_data = last_tool["data"]
        
        # LLM output giờ đây là text thuần, nhưng ta vẫn strip marker nếu AI lỡ tay copy lại
        clean_msg = raw_output.split("__TOOL_RESULT__:")[0].strip()
        if "```" in clean_msg:
             import re
             clean_msg = re.sub(r"```[a-z]*\n[\s\S]*?\n```", "", clean_msg).strip()
             if not clean_msg and final_action != "SHOW_INFO":
                  clean_msg = "Đây là kết quả của bạn:"
             elif not clean_msg:
                  clean_msg = "Chào bạn, mình có thể giúp gì cho bạn?"

        save_interaction(session_key, message, clean_msg)
        return clean_msg, final_action, final_data
        
    except Exception as e:
        logger.exception(f"Agent error: {e}")
        return "Xin lỗi bạn, mình gặp sự cố kỹ thuật. Bạn thử lại sau nhé 🙏", "SHOW_INFO", {}

async def chat_with_agent_astream(
    message: str, 
    session_key: str, 
    user_id: int | str | None = None,
    user_context_info: str = "Chưa có thông tin"
):
    """
    Generator trả về các event streaming cho FastAPI (SSE).
    """
    if not agent_executor:
        yield json.dumps({"type": "error", "content": "Lỗi khởi tạo LLM Agent."})
        return

    # Khởi tạo ngữ cảnh
    current_user_id.set(user_id)
    current_session_key.set(session_key)

    chat_history = get_chat_history(session_key)
    now = datetime.datetime.now()
    current_date_str = now.strftime("%Y-%m-%d %H:%M (%A)")

    max_retries = 2
    attempt = 0
    
    while attempt <= max_retries:
        final_sent = False
        full_content = ""
        
        try:
            async for event in agent_executor.astream_events(
                {
                    "input": message,
                    "chat_history": chat_history,
                    "current_date": current_date_str,
                    "user_context_info": user_context_info
                },
                version="v2"
            ):
                kind = event["event"]

                if kind == "on_tool_start":
                    yield json.dumps({"type": "tool_start", "content": f"Đang tìm kiếm..."})

                elif kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "tool_call_chunks") and chunk.tool_call_chunks:
                        continue
                    content = chunk.content
                    if content:
                        full_content += content
                        yield json.dumps({"type": "text", "content": content})

                elif kind == "on_agent_finish" or (kind == "on_chain_end" and event.get("name") == "AgentExecutor"):
                    pass

            # Kết thúc stream, lấy action từ cache (session_store)
            tool_actions = pop_ui_actions(session_key)
            last_action = "SHOW_INFO"
            last_action_data = {}
            if tool_actions:
                last_tool = tool_actions[-1]
                last_action = last_tool["action"]
                last_action_data = last_tool["data"]

            if not final_sent:
                save_interaction(session_key, message, full_content)
                yield json.dumps({
                    "type": "final",
                    "action": last_action,
                    "action_data": last_action_data
                })
                final_sent = True
            return

        except Exception as e:
            attempt += 1
            logger.error(f"[stream] Lỗi lần {attempt}/{max_retries + 1}: {e}")
            
            if attempt <= max_retries:
                # Đợi một chút trước khi thử lại
                await asyncio.sleep(1)
                continue 
            else:
                # Đã hết lượt thử lại
                yield json.dumps({"type": "text", "content": "\n\n**(Xin lỗi, mình gặp chút sự cố kết nối ổn định. Bạn thử gửi lại câu hỏi nhé!)** 🙏"})
                # Vẫn phải gửi final để đóng loading ở FE
                yield json.dumps({"type": "final", "action": "SHOW_INFO", "action_data": {}})
                break
