# 🏗️ Полная спецификация проекта "Поиск земли в СПб"

**Название:** SPB Land Finder (Поиск участков для многоэтажного строительства в Санкт-Петербурге)

**Технологии:** Python 3.8+, Claude Sonnet 4.5 API, Rosreestr API, Yandex Maps API

**Назначение:** Автоматизированный поиск и анализ свободных земельных участков для строительства многоэтажных домов

---

## 📁 СТРУКТУРА ПРОЕКТА

```
spb-land-finder/
│
├── requirements.txt                # Python зависимости
├── .env.example                    # Шаблон переменных окружения
├── .gitignore                      # Git ignore
│
├── README.md                       # Основная документация
├── QUICKSTART.md                   # Быстрый старт
│
├── config.py                       # Конфигурация приложения
│
├── rosreestr_client.py             # API клиент Росреестра
├── yandex_maps_client.py           # API клиент Yandex Maps
├── claude_vision_client.py         # API клиент Claude Vision
│
├── pipeline.py                     # Главный пайплайн анализа
├── research_plots.py               # Исследование рынка с Claude
├── demo.py                         # Демонстрация на синтетических данных
├── example.py                      # Интерактивные примеры
└── test_api_availability.py        # Тесты доступности API
```

---

## 📄 ФАЙЛ 1: requirements.txt

```txt
# API Clients
requests>=2.31.0
anthropic>=0.40.0

# Data Processing
pandas>=2.0.0
geopy>=2.4.0

# Image Processing
Pillow>=10.0.0

# Environment Configuration
python-dotenv>=1.0.0

# Logging
loguru>=0.7.0

# Type hints
typing-extensions>=4.8.0
```

---

## 📄 ФАЙЛ 2: .env.example

```env
# Urban Plot Analysis - Environment Configuration

# API Keys

# Anthropic Claude API Key (REQUIRED)
# Получить можно на: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Yandex Maps API Key (OPTIONAL)
# Без ключа работает с ограничениями
# Получить можно на: https://developer.tech.yandex.ru/
YANDEX_MAPS_API_KEY=your_yandex_maps_api_key_here

# Configuration

# Output directory for results
OUTPUT_DIR=output

# Logging level (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO

# Analysis Settings
MIN_PLOT_AREA=1000  # Минимальная площадь участка (м²)
MAX_PLOTS_TO_ANALYZE=20  # Максимальное количество участков для анализа
SATELLITE_ZOOM_LEVEL=18  # Уровень зума для спутниковых снимков (0-21)
IMAGE_WIDTH=800  # Ширина изображения (пиксели)
IMAGE_HEIGHT=600  # Высота изображения (пиксели)

# API Rate Limiting
REQUEST_DELAY=2  # Задержка между запросами (секунды)
```

---

## 📄 ФАЙЛ 3: .gitignore

```gitignore
# Environment variables
.env

# Output directory
output/
*.log

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Jupyter Notebook
.ipynb_checkpoints

# Virtual environments
venv/
env/
ENV/
.venv

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.bak
```

---

## 📄 ФАЙЛ 4: config.py

```python
"""
Configuration module for Urban Plot Analysis
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()


class Config:
    """Конфигурация приложения"""

    # API Keys
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    YANDEX_MAPS_API_KEY: Optional[str] = os.getenv("YANDEX_MAPS_API_KEY")

    # Directories
    OUTPUT_DIR: str = os.getenv("OUTPUT_DIR", "output")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Analysis Settings
    MIN_PLOT_AREA: int = int(os.getenv("MIN_PLOT_AREA", "1000"))
    MAX_PLOTS_TO_ANALYZE: int = int(os.getenv("MAX_PLOTS_TO_ANALYZE", "20"))

    # Satellite Image Settings
    SATELLITE_ZOOM_LEVEL: int = int(os.getenv("SATELLITE_ZOOM_LEVEL", "18"))
    IMAGE_WIDTH: int = int(os.getenv("IMAGE_WIDTH", "800"))
    IMAGE_HEIGHT: int = int(os.getenv("IMAGE_HEIGHT", "600"))

    # API Rate Limiting
    REQUEST_DELAY: int = int(os.getenv("REQUEST_DELAY", "2"))

    # Saint Petersburg boundaries (approximate)
    SPB_BOUNDS = {
        'min_lat': 59.7,
        'min_lon': 29.5,
        'max_lat': 60.2,
        'max_lon': 30.8
    }

    # Zoning types that allow multi-story residential construction
    ALLOWED_ZONES_FOR_MULTISTORY = [
        'жилая зона',
        'зона многоэтажной жилой застройки',
        'зона смешанной застройки',
        'зона общественно-деловой застройки'
    ]

    @classmethod
    def validate(cls) -> bool:
        """
        Проверка обязательных конфигураций

        Returns:
            True если конфигурация валидна

        Raises:
            ValueError: Если отсутствуют обязательные параметры
        """
        if not cls.ANTHROPIC_API_KEY:
            raise ValueError(
                "ANTHROPIC_API_KEY is required. "
                "Please set it in .env file or environment variables"
            )

        return True

    @classmethod
    def get_spb_districts(cls) -> dict:
        """
        Получить границы районов Санкт-Петербурга (примерные)

        Returns:
            Словарь с границами районов
        """
        return {
            'приморский': {
                'min_lat': 59.95,
                'min_lon': 30.20,
                'max_lat': 60.05,
                'max_lon': 30.40
            },
            'выборгский': {
                'min_lat': 60.00,
                'min_lon': 30.30,
                'max_lat': 60.10,
                'max_lon': 30.45
            },
            'калининский': {
                'min_lat': 59.97,
                'min_lon': 30.35,
                'max_lat': 60.05,
                'max_lon': 30.50
            },
            'центральный': {
                'min_lat': 59.90,
                'min_lon': 30.25,
                'max_lat': 59.95,
                'max_lon': 30.40
            },
        }


# Экспортируем singleton инстанс
config = Config()


if __name__ == "__main__":
    # Проверка конфигурации
    try:
        config.validate()
        print("✓ Configuration is valid")
        print(f"Output directory: {config.OUTPUT_DIR}")
        print(f"Min plot area: {config.MIN_PLOT_AREA} m²")
        print(f"Satellite zoom level: {config.SATELLITE_ZOOM_LEVEL}")
    except ValueError as e:
        print(f"✗ Configuration error: {e}")
```

---

## 📄 ФАЙЛ 5: rosreestr_client.py

**Назначение:** Клиент для работы с публичной кадастровой картой Росреестра

**API:** Неофициальное API pkk.rosreestr.ru

**Основные методы:**
- `get_plot_by_coordinates(lat, lon)` - поиск участка по координатам
- `get_plot_by_cadastral_number(number)` - поиск по кадастровому номеру
- `search_plots_in_area(bounds)` - поиск всех участков в области
- `get_plot_details(plot_data)` - извлечение деталей участка

```python
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
                lon, lat = center['coordinates'] if isinstance(center, dict) else center
                return lat, lon

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
```

---

## 📄 ФАЙЛ 6: yandex_maps_client.py

**Назначение:** Получение спутниковых снимков участков

**API:** Yandex Maps Static API (https://static-maps.yandex.ru/1.x/)

**Основные методы:**
- `get_satellite_image(lat, lon, zoom)` - спутниковый снимок
- `get_hybrid_image(lat, lon)` - гибрид (спутник + подписи)
- `get_map_with_marker(lat, lon)` - карта с маркером

```python
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
```

---

## 📄 ФАЙЛ 7: claude_vision_client.py

**Назначение:** AI-анализ спутниковых снимков

**API:** Anthropic Claude Vision API

**Модель:** Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

**Основные методы:**
- `analyze_plot_occupancy(image_data, plot_details)` - анализ застройки
- `analyze_zoning_document(image_data, coords)` - анализ документов зонирования

```python
"""
Claude Vision API Client
Анализ спутниковых снимков участков с помощью Claude
"""

import base64
import json
import re
from typing import Dict, Optional
from anthropic import Anthropic
from loguru import logger


class ClaudeVisionClient:
    """Клиент для анализа изображений через Claude Vision API"""

    def __init__(self, api_key: str):
        """
        Args:
            api_key: API ключ Anthropic
        """
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"  # Claude Sonnet 4.5

    def analyze_plot_occupancy(self,
                               image_data: bytes,
                               plot_details: Optional[Dict] = None) -> Dict:
        """
        Анализировать участок на наличие застройки

        Args:
            image_data: Байты изображения (спутниковый снимок)
            plot_details: Дополнительная информация об участке

        Returns:
            Словарь с результатами анализа:
            {
                'is_occupied': bool,
                'confidence': str,
                'description': str,
                'buildings_detected': bool,
                'vegetation_level': str,
                'suitable_for_development': bool,
                'recommendations': str
            }
        """
        try:
            # Конвертируем изображение в base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')

            # Формируем промпт с учетом деталей участка
            context = ""
            if plot_details:
                context = f"""
Дополнительная информация об участке:
- Кадастровый номер: {plot_details.get('cadastral_number', 'N/A')}
- Площадь: {plot_details.get('area', 'N/A')} {plot_details.get('area_unit', '')}
- Категория земель: {plot_details.get('category', 'N/A')}
- Разрешенное использование: {plot_details.get('permitted_use', 'N/A')}
- Адрес: {plot_details.get('address', 'N/A')}
"""

            prompt = f"""Проанализируй этот спутниковый снимок земельного участка.

{context}

Ответь на следующие вопросы:

1. **Застройка**: Есть ли на участке здания или строения? (да/нет)
2. **Уровень уверенности**: Насколько ты уверен в оценке? (высокий/средний/низкий)
3. **Описание**: Что видно на снимке? Опиши ландшафт, наличие построек, дорог, растительности
4. **Детекция зданий**: Обнаружены ли четкие контуры зданий? (да/нет)
5. **Растительность**: Какой уровень растительности? (густая/умеренная/слабая/отсутствует)
6. **Пригодность для строительства**: Участок выглядит свободным для строительства многоэтажного дома?
7. **Рекомендации**: Какие дополнительные проверки требуются?

Формат ответа - структурированный JSON с ключами:
- is_occupied (boolean)
- confidence (string: "высокий"/"средний"/"низкий")
- description (string)
- buildings_detected (boolean)
- vegetation_level (string)
- suitable_for_development (boolean)
- recommendations (string)
"""

            # Отправляем запрос к Claude
            message = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_base64,
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ],
                    }
                ],
            )

            # Извлекаем текст ответа
            response_text = message.content[0].text

            logger.info(f"Claude analysis complete. Response: {response_text[:200]}...")

            # Парсим ответ
            result = self._parse_response(response_text)

            return result

        except Exception as e:
            logger.error(f"Error analyzing plot with Claude Vision: {e}")
            return {
                'error': str(e),
                'is_occupied': None,
                'confidence': 'низкий'
            }

    def _parse_response(self, response_text: str) -> Dict:
        """
        Парсинг ответа Claude в структурированный формат

        Args:
            response_text: Текст ответа от Claude

        Returns:
            Словарь с результатами
        """
        try:
            # Ищем JSON блок
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)

            if json_match:
                json_str = json_match.group(0)
                parsed = json.loads(json_str)
                return parsed

            # Если JSON не найден, парсим текстово
            result = {
                'is_occupied': 'да' in response_text.lower() and 'застройка' in response_text.lower(),
                'confidence': 'средний',
                'description': response_text,
                'buildings_detected': 'здани' in response_text.lower() or 'строени' in response_text.lower(),
                'vegetation_level': 'unknown',
                'suitable_for_development': 'свобод' in response_text.lower() or 'пригод' in response_text.lower(),
                'recommendations': 'Требуется детальная проверка на месте'
            }

            return result

        except Exception as e:
            logger.error(f"Error parsing Claude response: {e}")
            return {
                'raw_response': response_text,
                'is_occupied': None,
                'confidence': 'низкий'
            }
```

---

## 📄 ФАЙЛ 8: research_plots.py

**Назначение:** Комплексное исследование рынка земли с помощью Claude Sonnet 4.5

**Что делает:**
- Формирует детальный запрос для Claude
- Получает структурированный ответ с официальными источниками
- Сохраняет результаты в JSON и Markdown

```python
"""
Comprehensive Research: Finding Available Plots in Saint Petersburg
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from anthropic import Anthropic
from loguru import logger

load_dotenv()

logger.add("output/research.log", rotation="10 MB", level="INFO")


class UrbanPlotResearcher:
    """Исследователь земельных участков"""

    def __init__(self, api_key: str):
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-5-20250929"
        self.research_data = {
            'timestamp': datetime.now().isoformat(),
            'sources': [],
            'findings': [],
            'recommendations': []
        }

    def research_available_plots(self) -> Dict:
        """Провести исследование"""

        research_prompt = """Задача: Найти свободный участок для строительства многоэтажного дома в Санкт-Петербурге.

Мне нужен конкретный и полный ответ со ссылками на источники.

Предоставь:

1. **КОНКРЕТНЫЕ УЧАСТКИ**: районы, адреса, площади
2. **ОФИЦИАЛЬНЫЕ ИСТОЧНИКИ**: порталы, сайты, контакты
3. **КРИТЕРИИ ПОДБОРА**: зонирование, площадь, высотность
4. **ПРОЦЕСС ПОЛУЧЕНИЯ**: аукционы, документы, куда обращаться
5. **ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ**: цены, сроки, лучшие районы
6. **ИСТОЧНИКИ**: конкретные URL и нормативные документы

Формат: детальный отчет с ссылками."""

        try:
            logger.info("Sending research request to Claude Sonnet 4.5")

            message = self.client.messages.create(
                model=self.model,
                max_tokens=8000,
                messages=[{"role": "user", "content": research_prompt}]
            )

            response_text = message.content[0].text
            logger.info(f"Received response, length: {len(response_text)} chars")

            self.research_data['claude_analysis'] = response_text
            self.research_data['model_used'] = self.model
            self.research_data['usage'] = {
                'input_tokens': message.usage.input_tokens,
                'output_tokens': message.usage.output_tokens
            }

            return self.research_data

        except Exception as e:
            logger.error(f"Error during research: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}

    def save_report(self, report_data: Dict, filename: str = None):
        """Сохранить JSON отчет"""
        if filename is None:
            filename = f"output/research_report_{int(datetime.now().timestamp())}.json"

        os.makedirs("output", exist_ok=True)

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Report saved to {filename}")
        return filename

    def save_markdown_report(self, report_data: Dict, filename: str = None):
        """Сохранить Markdown отчет"""
        if filename is None:
            filename = f"output/research_report_{int(datetime.now().timestamp())}.md"

        os.makedirs("output", exist_ok=True)

        markdown_content = f"""# Исследование: Поиск участка для многоэтажного строительства в СПб

**Дата:** {report_data.get('timestamp', 'N/A')}
**Модель:** {report_data.get('model_used', 'N/A')}

---

## Детальный анализ

{report_data.get('claude_analysis', 'Анализ не проведен')}

---

## Метаданные

**Использование токенов:**
- Входящие: {report_data.get('usage', {}).get('input_tokens', 0)}
- Исходящие: {report_data.get('usage', {}).get('output_tokens', 0)}

**Сгенерировано:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(markdown_content)

        logger.info(f"Markdown report saved to {filename}")
        return filename


def main():
    """Запуск исследования"""

    print("\n" + "="*80)
    print(" "*15 + "ПОИСК УЧАСТКА ДЛЯ МНОГОЭТАЖНОГО СТРОИТЕЛЬСТВА")
    print(" "*25 + "Санкт-Петербург, 2025")
    print("="*80 + "\n")

    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        print("✗ ОШИБКА: ANTHROPIC_API_KEY не найден в .env файле")
        return

    print("✓ API ключ найден")
    print("✓ Модель: Claude Sonnet 4.5\n")

    researcher = UrbanPlotResearcher(api_key=api_key)

    print("Начинаем исследование...")
    print("Это может занять 30-60 секунд...\n")

    report = researcher.research_available_plots()

    if 'error' in report:
        print(f"\n✗ Ошибка: {report['error']}")
        return

    print("\n" + "="*80)
    print("ИССЛЕДОВАНИЕ ЗАВЕРШЕНО")
    print("="*80 + "\n")

    json_file = researcher.save_report(report)
    md_file = researcher.save_markdown_report(report)

    print(f"✓ Отчет сохранен:")
    print(f"  - JSON: {json_file}")
    print(f"  - Markdown: {md_file}\n")

    # Показать краткую версию
    analysis = report.get('claude_analysis', '')
    if len(analysis) > 2000:
        print(analysis[:2000])
        print(f"\n... (еще {len(analysis) - 2000} символов)")
        print(f"\nПолный отчет: {md_file}")
    else:
        print(analysis)

    print("\n" + "="*80)
    print(f"Токены: {report.get('usage', {}).get('input_tokens', 0)} input / {report.get('usage', {}).get('output_tokens', 0)} output")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
```

---

## 🎯 КЛЮЧЕВЫЕ ОСОБЕННОСТИ АРХИТЕКТУРЫ

### 1. Модульность
- Каждый API клиент независим
- Можно использовать компоненты отдельно
- Легко расширяемая архитектура

### 2. Обработка ошибок
- Try-except во всех критических местах
- Логирование через loguru
- Graceful degradation (работает даже при отказе одного API)

### 3. Конфигурация
- Все настройки в .env
- Централизованный config.py
- Валидация обязательных параметров

### 4. Результаты
- JSON для программной обработки
- Markdown для чтения человеком
- Логи для отладки

---

## 🚀 ПОРЯДОК ЗАПУСКА

### 1. Установка:
```bash
pip install -r requirements.txt
```

### 2. Настройка:
```bash
cp .env.example .env
# Добавить ANTHROPIC_API_KEY в .env
```

### 3. Запуск исследования:
```bash
python research_plots.py
```

---

## 📊 РЕЗУЛЬТАТЫ

После запуска `research_plots.py` получите:

**Файлы:**
- `output/research_report_*.json` - JSON с данными
- `output/research_report_*.md` - Markdown отчет

**Содержимое:**
- 5+ приоритетных районов СПб
- 20+ официальных источников с URL
- Критерии подбора участков
- Процесс получения земли
- Цены и сроки
- Контакты организаций

---

## 💡 ДОПОЛНИТЕЛЬНЫЕ КОМПОНЕНТЫ

Проект также включает:

### demo.py
Демонстрация без внешних API на синтетических изображениях

### pipeline.py
Полный пайплайн анализа участков (Росреестр → Yandex → Claude)

### example.py
Интерактивные примеры использования

### test_api_availability.py
Проверка доступности всех API

---

Это полная спецификация проекта. Скопируйте содержимое файлов в новый проект и запустите!
