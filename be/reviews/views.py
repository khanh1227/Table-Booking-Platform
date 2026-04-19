from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import Review, ReviewReply, ReviewReport
from .serializers import ReviewSerializer, ReviewReplySerializer, ReviewReportSerializer
from bookings.models import Booking

from django_filters.rest_framework import DjangoFilterBackend

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related('customer', 'restaurant', 'reply')
    serializer_class = ReviewSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['restaurant', 'customer', 'booking']

    def get_permissions(self):
        if self.action in ['create', 'reply', 'report']:
            return [permissions.IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        if request.user.role != 'ADMIN' and review.customer != request.user:
            return Response({'error': 'Bạn không có quyền xoá.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        if review.customer != request.user:
            return Response({'error': 'Bạn không có quyền sửa.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        booking = serializer.validated_data['booking']
        serializer.save(
            customer=self.request.user,
            restaurant=booking.restaurant
        )

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        review = self.get_object()
        if request.user.role != 'PARTNER' or review.restaurant.partner != request.user.partner:
            return Response({'error': 'Bạn không có quyền phản hồi đánh giá này.'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = ReviewReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review, partner=request.user.partner)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def report(self, request, pk=None):
        review = self.get_object()
        if request.user.role != 'PARTNER' or review.restaurant.partner != request.user.partner:
            return Response({'error': 'Bạn không có quyền báo cáo đánh giá này.'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = ReviewReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review, partner=request.user.partner)
        return Response({'message': 'Báo cáo đã được gửi.'}, status=status.HTTP_201_CREATED)

class AdminReviewReportViewSet(viewsets.ViewSet):
    """
    API nội bộ cho Admin Moderator.
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        if request.user.role != 'ADMIN':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        reports = ReviewReport.objects.select_related('review', 'partner', 'review__customer', 'review__restaurant').all().order_by('status', '-created_at')
        
        data = []
        for r in reports:
            data.append({
                'id': r.pk,
                'status': r.status,
                'reason': r.reason,
                'reported_by': r.partner.business_name,
                'created_at': r.created_at,
                'review': {
                    'id': r.review.id,
                    'rating': r.review.rating,
                    'comment': r.review.comment,
                    'customer_name': r.review.customer.full_name,
                    'restaurant_name': r.review.restaurant.name,
                }
            })
        return Response(data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Đóng ticket report, giữ review"""
        if request.user.role != 'ADMIN':
            return Response(status=403)
        report = get_object_or_404(ReviewReport, pk=pk)
        report.status = 'RESOLVED'
        report.save()
        return Response({'message': 'Đã huỷ khiếu nại'})

    @action(detail=True, methods=['post'])
    def delete_review(self, request, pk=None):
        """Xoá review lỗi"""
        if request.user.role != 'ADMIN':
            return Response(status=403)
        report = get_object_or_404(ReviewReport, pk=pk)
        review = report.review
        review.delete() # Trigger signals and implicitly cascade deletes reports
        return Response({'message': 'Đã xoá review và đóng các khiếu nại liên quan'})
