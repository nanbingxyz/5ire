"""
Yandex Maps Static API Client
Получение спутниковых снимков для анализа участков
"""

import requests
from typing import Optional
from io import BytesIO
from PIL import Image
from loguru import logger


class YandexMapsClient:
    """Клиент для работы с Yandex Maps Static API"""

    STATIC_API_URL = "https://static-maps.yandex.ru/1.x/"

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: API ключ Yandex (опционально для некоторых запросов)
        """
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://yandex.ru/',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-site'
        })

    def get_satellite_image(self,
                           lat: float,
                           lon: float,
                           zoom: int = 17,
                           width: int = 650,
                           height: int = 450,
                           save_path: Optional[str] = None) -> Optional[bytes]:
        """
        Получить спутниковый снимок участка

        Args:
            lat: Широта центра
            lon: Долгота центра
            zoom: Уровень масштабирования (0-21)
            width: Ширина изображения в пикселях
            height: Высота изображения в пикселях
            save_path: Путь для сохранения изображения (опционально)

        Returns:
            Байты изображения или None
        """
        try:
            params = {
                'll': f'{lon},{lat}',  # Yandex использует lon,lat
                'z': zoom,
                'l': 'sat',  # Тип слоя: sat (спутник)
                'size': f'{width},{height}'
            }

            if self.api_key:
                params['apikey'] = self.api_key

            response = self.session.get(
                self.STATIC_API_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()

            image_data = response.content

            # Проверяем, что получили изображение
            try:
                img = Image.open(BytesIO(image_data))
                logger.info(f"Successfully retrieved satellite image at ({lat}, {lon}), size: {img.size}")

                # Сохраняем если указан путь
                if save_path:
                    with open(save_path, 'wb') as f:
                        f.write(image_data)
                    logger.info(f"Image saved to {save_path}")

                return image_data

            except Exception as e:
                logger.error(f"Invalid image data received: {e}")
                return None

        except Exception as e:
            logger.error(f"Error getting satellite image: {e}")
            return None

    def get_hybrid_image(self,
                        lat: float,
                        lon: float,
                        zoom: int = 17,
                        width: int = 650,
                        height: int = 450,
                        save_path: Optional[str] = None) -> Optional[bytes]:
        """
        Получить гибридный снимок (спутник + подписи)

        Args:
            lat: Широта центра
            lon: Долгота центра
            zoom: Уровень масштабирования (0-21)
            width: Ширина изображения в пикселях
            height: Высота изображения в пикселях
            save_path: Путь для сохранения изображения (опционально)

        Returns:
            Байты изображения или None
        """
        try:
            params = {
                'll': f'{lon},{lat}',
                'z': zoom,
                'l': 'sat,skl',  # sat + skl (satellite + skeleton/labels)
                'size': f'{width},{height}'
            }

            if self.api_key:
                params['apikey'] = self.api_key

            response = self.session.get(
                self.STATIC_API_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()

            image_data = response.content

            if save_path:
                with open(save_path, 'wb') as f:
                    f.write(image_data)
                logger.info(f"Hybrid image saved to {save_path}")

            return image_data

        except Exception as e:
            logger.error(f"Error getting hybrid image: {e}")
            return None

    def get_map_with_marker(self,
                           lat: float,
                           lon: float,
                           zoom: int = 17,
                           width: int = 650,
                           height: int = 450,
                           marker_style: str = "pm2rdm",
                           save_path: Optional[str] = None) -> Optional[bytes]:
        """
        Получить карту с маркером на участке

        Args:
            lat: Широта
            lon: Долгота
            zoom: Уровень масштабирования
            width: Ширина изображения
            height: Высота изображения
            marker_style: Стиль маркера (pm2rdm - красный, pm2grm - зеленый, и т.д.)
            save_path: Путь для сохранения

        Returns:
            Байты изображения или None
        """
        try:
            params = {
                'll': f'{lon},{lat}',
                'z': zoom,
                'l': 'sat',
                'size': f'{width},{height}',
                'pt': f'{lon},{lat},{marker_style}'  # Добавляем маркер
            }

            if self.api_key:
                params['apikey'] = self.api_key

            response = self.session.get(
                self.STATIC_API_URL,
                params=params,
                timeout=30
            )
            response.raise_for_status()

            image_data = response.content

            if save_path:
                with open(save_path, 'wb') as f:
                    f.write(image_data)
                logger.info(f"Map with marker saved to {save_path}")

            return image_data

        except Exception as e:
            logger.error(f"Error getting map with marker: {e}")
            return None


# Пример использования
if __name__ == "__main__":
    from loguru import logger

    logger.add("yandex_maps_client.log", rotation="10 MB")

    client = YandexMapsClient()

    # Координаты примерного участка в Санкт-Петербурге
    lat, lon = 59.9311, 30.3609

    # Получаем спутниковый снимок
    image_data = client.get_satellite_image(
        lat=lat,
        lon=lon,
        zoom=18,
        save_path="test_satellite.png"
    )

    if image_data:
        logger.info(f"Successfully retrieved image, size: {len(image_data)} bytes")

    # Получаем гибридное изображение
    hybrid_data = client.get_hybrid_image(
        lat=lat,
        lon=lon,
        zoom=18,
        save_path="test_hybrid.png"
    )

    if hybrid_data:
        logger.info(f"Successfully retrieved hybrid image")
