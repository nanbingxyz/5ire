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
            # Добавьте другие районы по необходимости
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
