"""
Rosreestr API Client
Работа с публичной кадастровой картой (ПКК) через неофициальное API
"""

import requests
from typing import Dict, List, Optional, Tuple
from loguru import logger


class RosreestrClient:
    """Клиент для работы с API Росреестра"""

    BASE_URL = "https://pkk.rosreestr.ru/api"
    NSPD_BASE_URL = "https://nspd.gov.ru/api"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://pkk.rosreestr.ru/',
            'Origin': 'https://pkk.rosreestr.ru',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        })

    def get_plot_by_coordinates(self, lat: float, lon: float) -> Optional[Dict]:
        """
        Получить информацию об участке по координатам

        Args:
            lat: Широта
            lon: Долгота

        Returns:
            Информация об участке или None
        """
        try:
            # Конвертируем координаты в нужный формат
            url = f"{self.BASE_URL}/features/1"
            params = {
                'text': f'{lat} {lon}',
                'tolerance': 4,
                'limit': 40
            }

            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            if data.get('features'):
                logger.info(f"Found {len(data['features'])} plots at coordinates ({lat}, {lon})")
                return data['features'][0]

            logger.warning(f"No plots found at coordinates ({lat}, {lon})")
            return None

        except Exception as e:
            logger.error(f"Error getting plot by coordinates: {e}")
            return None

    def get_plot_by_cadastral_number(self, cadastral_number: str) -> Optional[Dict]:
        """
        Получить информацию об участке по кадастровому номеру

        Args:
            cadastral_number: Кадастровый номер (формат: XX:XX:XXXXXXX:XX)

        Returns:
            Информация об участке или None
        """
        try:
            url = f"{self.BASE_URL}/features/1/{cadastral_number}"

            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            data = response.json()

            if data:
                logger.info(f"Found plot with cadastral number {cadastral_number}")
                return data

            logger.warning(f"Plot {cadastral_number} not found")
            return None

        except Exception as e:
            logger.error(f"Error getting plot by cadastral number: {e}")
            return None

    def get_plot_coordinates(self, plot_data: Dict) -> Optional[Tuple[float, float]]:
        """
        Извлечь центральные координаты участка из данных

        Args:
            plot_data: Данные об участке из API

        Returns:
            Кортеж (latitude, longitude) или None
        """
        try:
            if 'center' in plot_data:
                center = plot_data['center']
                # Координаты в ПКК часто в формате [lon, lat]
                lon, lat = center['coordinates'] if isinstance(center, dict) else center
                return lat, lon

            # Альтернативный способ - взять центр из extent
            if 'extent' in plot_data:
                extent = plot_data['extent']
                lat = (extent['ymin'] + extent['ymax']) / 2
                lon = (extent['xmin'] + extent['xmax']) / 2
                return lat, lon

            logger.warning("Could not extract coordinates from plot data")
            return None

        except Exception as e:
            logger.error(f"Error extracting coordinates: {e}")
            return None

    def search_plots_in_area(self,
                            min_lat: float,
                            min_lon: float,
                            max_lat: float,
                            max_lon: float,
                            limit: int = 100) -> List[Dict]:
        """
        Поиск участков в заданной области

        Args:
            min_lat: Минимальная широта
            min_lon: Минимальная долгота
            max_lat: Максимальная широта
            max_lon: Максимальная долгота
            limit: Максимальное количество участков

        Returns:
            Список участков
        """
        try:
            # Используем features API для поиска в области
            url = f"{self.BASE_URL}/features/1"

            # Формируем WKT polygon
            wkt = f"POLYGON(({min_lon} {min_lat},{max_lon} {min_lat},{max_lon} {max_lat},{min_lon} {max_lat},{min_lon} {min_lat}))"

            params = {
                'text': wkt,
                'limit': limit
            }

            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            plots = data.get('features', [])
            logger.info(f"Found {len(plots)} plots in area")

            return plots

        except Exception as e:
            logger.error(f"Error searching plots in area: {e}")
            return []

    def get_plot_details(self, plot_data: Dict) -> Dict:
        """
        Извлечь основные детали участка

        Args:
            plot_data: Данные об участке

        Returns:
            Словарь с деталями
        """
        try:
            attrs = plot_data.get('attrs', {})

            details = {
                'cadastral_number': attrs.get('cn', 'N/A'),
                'area': attrs.get('area_value', 0),
                'area_unit': attrs.get('area_unit', 'м²'),
                'category': attrs.get('category_type', 'N/A'),
                'permitted_use': attrs.get('util_by_doc', 'N/A'),
                'address': attrs.get('address', 'N/A'),
                'cost': attrs.get('cad_cost', 0),
            }

            return details

        except Exception as e:
            logger.error(f"Error extracting plot details: {e}")
            return {}


# Пример использования
if __name__ == "__main__":
    from loguru import logger

    logger.add("rosreestr_client.log", rotation="10 MB")

    client = RosreestrClient()

    # Пример: поиск участка по координатам в Санкт-Петербурге
    # Координаты примерной точки в СПб
    lat, lon = 59.9311, 30.3609

    plot = client.get_plot_by_coordinates(lat, lon)

    if plot:
        details = client.get_plot_details(plot)
        logger.info(f"Plot details: {details}")

        coords = client.get_plot_coordinates(plot)
        logger.info(f"Plot coordinates: {coords}")
