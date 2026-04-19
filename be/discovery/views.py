from rest_framework import viewsets, permissions, status, serializers as drf_serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Collection, CollectionItem, Banner
from .serializers import CollectionSerializer, CollectionItemSerializer, BannerSerializer
from restaurants.models import Restaurant

class IsAdmin(permissions.BasePermission):
    """
    Cho phép truy cập nếu user có role là ADMIN.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')

class CollectionViewSet(viewsets.ModelViewSet):
    """
    Public: list/retrieve (AllowAny)
    Admin: create/update/delete, add_restaurant / remove_restaurant
    """
    serializer_class = CollectionSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        queryset = Collection.objects.filter(is_active=True)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Tạo collection mới. Body: { title, description, cover_image_url, restaurant_ids: [int] }
        """
        title = request.data.get('title')
        description = request.data.get('description', '')
        cover_image_url = request.data.get('cover_image_url', '')
        restaurant_ids = request.data.get('restaurant_ids', [])

        if not title:
            return Response({'error': 'title is required'}, status=status.HTTP_400_BAD_REQUEST)

        collection = Collection.objects.create(
            title=title,
            description=description,
            cover_image_url=cover_image_url,
        )

        # Thêm restaurants vào collection
        for r_id in restaurant_ids:
            try:
                restaurant = Restaurant.objects.get(id=r_id, status='APPROVED')
                CollectionItem.objects.create(collection=collection, restaurant=restaurant)
            except Restaurant.DoesNotExist:
                pass

        serializer = self.get_serializer(collection)
        return Response({
            'message': 'Tạo bộ sưu tập thành công',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.title = request.data.get('title', instance.title)
        instance.description = request.data.get('description', instance.description)
        instance.cover_image_url = request.data.get('cover_image_url', instance.cover_image_url)
        instance.save()

        serializer = self.get_serializer(instance)
        return Response({
            'message': 'Cập nhật bộ sưu tập thành công',
            'data': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='add-restaurant')
    def add_restaurant(self, request, pk=None):
        collection = self.get_object()
        restaurant_id = request.data.get('restaurant_id')
        if not restaurant_id:
            return Response({'error': 'restaurant_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            restaurant = Restaurant.objects.get(id=restaurant_id, status='APPROVED')
        except Restaurant.DoesNotExist:
            return Response({'error': 'Nhà hàng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        if CollectionItem.objects.filter(collection=collection, restaurant=restaurant).exists():
            return Response({'error': 'Nhà hàng đã có trong bộ sưu tập này'}, status=status.HTTP_400_BAD_REQUEST)

        CollectionItem.objects.create(collection=collection, restaurant=restaurant)
        return Response({'message': f'Đã thêm {restaurant.name} vào bộ sưu tập'})

    @action(detail=True, methods=['post'], url_path='remove-restaurant')
    def remove_restaurant(self, request, pk=None):
        collection = self.get_object()
        restaurant_id = request.data.get('restaurant_id')
        if not restaurant_id:
            return Response({'error': 'restaurant_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = CollectionItem.objects.filter(
            collection=collection, restaurant_id=restaurant_id
        ).delete()

        if deleted_count == 0:
            return Response({'error': 'Nhà hàng không có trong bộ sưu tập này'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({'message': 'Đã xóa nhà hàng khỏi bộ sưu tập'})


class BannerViewSet(viewsets.ModelViewSet):
    """
    Public: list (AllowAny)
    Admin: create/update/delete
    """
    serializer_class = BannerSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        return Banner.objects.filter(is_active=True).order_by('display_order')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'message': 'Tạo banner thành công',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
