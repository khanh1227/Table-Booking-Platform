from rest_framework import viewsets, permissions, status, filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import Post, Comment
from .serializers import (
    PostListSerializer, PostDetailSerializer, 
    PostCreateUpdateSerializer, CommentSerializer
)

class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'content', 'excerpt']
    ordering_fields = ['created_at', 'views_count']
    ordering = ['-created_at']
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'list':
            return PostListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return PostCreateUpdateSerializer
        return PostDetailSerializer

    def get_queryset(self):
        # Public only sees PUBLISHED posts
        if self.action in ['list', 'retrieve']:
            return Post.objects.filter(status='PUBLISHED')
        
        # Admin sees everything
        if getattr(self.request.user, 'role', None) == 'ADMIN':
            return Post.objects.all()
        
        # Users see their own posts
        if self.request.user.is_authenticated:
            return Post.objects.filter(author=self.request.user)
        
        return Post.objects.none()

    def perform_create(self, serializer):
        # Default status is PENDING if not admin
        is_admin = getattr(self.request.user, 'role', None) == 'ADMIN'
        status = 'PUBLISHED' if is_admin else 'PENDING'
        serializer.save(author=self.request.user, status=status)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAdminUser])
    def pending_approval(self, request):
        """Lấy danh sách bài viết chờ duyệt (Chỉ Admin)"""
        pending = Post.objects.filter(status='PENDING')
        serializer = PostListSerializer(pending, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def approve(self, request, slug=None):
        """Duyệt bài viết (Chỉ Admin)"""
        post = self.get_object()
        post.status = 'PUBLISHED'
        post.save()
        return Response({'status': 'Post approved'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, slug=None):
        """Thích hoặc bỏ thích bài viết"""
        post = self.get_object()
        user = request.user
        
        if post.likes.filter(id=user.id).exists():
            post.likes.remove(user)
            liked = False
        else:
            post.likes.add(user)
            liked = True
            
        return Response({
            'liked': liked,
            'likes_count': post.likes.count()
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def reject(self, request, slug=None):
        """Từ chối bài viết (Chỉ Admin)"""
        post = self.get_object()
        post.status = 'REJECTED'
        post.save()
        return Response({'status': 'Post rejected'})

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
