import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Mail, Lock, AlertCircle } from "lucide-react-native";
import { onLogin } from "../../services/api";

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginModal({ visible, onClose, onLoginSuccess }: LoginModalProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone || !password) {
       setError("Vui lòng nhập đầy đủ thông tin");
       return;
    }

    setError("");
    setLoading(true);

    try {
      const { error } = await onLogin(phone, password);
      if (error) {
        setError(
          error === "Invalid login credentials"
            ? "Số điện thoại hoặc mật khẩu không đúng"
            : error
        );
      } else {
        // Thành công
        onLoginSuccess();
        // Reset form
        setPhone("");
        setPassword("");
      }
    } catch (err) {
      setError("Có lỗi khi đăng nhập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X color="#9ca3af" size={24} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Đăng Nhập</Text>
              <Text style={styles.subtitle}>Chào mừng bạn quay trở lại!</Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <AlertCircle color="#dc2626" size={18} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <View style={styles.inputWrapper}>
                <Mail color="#9ca3af" size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="0912345678"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <Lock color="#9ca3af" size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitBtnText}>Đăng Nhập</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
               <Text style={styles.footerText}>Chưa có tài khoản? </Text>
               <TouchableOpacity onPress={() => Alert.alert("Thông báo", "Chức năng Đăng ký đang phát triển")}>
                  <Text style={styles.linkText}>Đăng ký ngay</Text>
               </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  keyboardView: { flex: 1, justifyContent: 'center' },
  container: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    elevation: 5,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  header: { alignItems: "center", marginBottom: 24, marginTop: 10 },
  title: { fontSize: 28, fontWeight: "bold", color: "#1f2937", marginBottom: 8 },
  subtitle: { color: "#4b5563" },
  errorBox: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  errorText: { color: "#dc2626", marginLeft: 8, flex: 1 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  submitBtn: {
    backgroundColor: "#d97706",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  disabledBtn: { opacity: 0.7 },
  submitBtnText: { color: "white", fontSize: 16, fontWeight: "bold" },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#4b5563' },
  linkText: { color: '#d97706', fontWeight: '600' }
});