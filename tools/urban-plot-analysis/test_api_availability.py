"""
Тест доступности API
Проверка работоспособности всех компонентов системы
"""

import os
from dotenv import load_dotenv
from loguru import logger

# Загружаем переменные окружения
load_dotenv()


def test_rosreestr_api():
    """Тест доступности API Росреестра"""
    print("\n" + "="*60)
    print("ТЕСТ 1: Росреестр API")
    print("="*60)

    try:
        from rosreestr_client import RosreestrClient

        client = RosreestrClient()

        # Тестируем поиск по координатам (центр СПб)
        print("\nПоиск участка по координатам центра СПб...")
        lat, lon = 59.9311, 30.3609

        plot = client.get_plot_by_coordinates(lat, lon)

        if plot:
            print("✓ API Росреестра доступен!")
            details = client.get_plot_details(plot)
            print(f"  Найден участок: {details.get('cadastral_number', 'N/A')}")
            print(f"  Площадь: {details.get('area', 'N/A')} {details.get('area_unit', '')}")
            return True
        else:
            print("⚠ Участок не найден, но API доступен")
            return True

    except Exception as e:
        print(f"✗ Ошибка API Росреестра: {e}")
        return False


def test_yandex_maps_api():
    """Тест доступности Yandex Maps API"""
    print("\n" + "="*60)
    print("ТЕСТ 2: Yandex Maps API")
    print("="*60)

    try:
        from yandex_maps_client import YandexMapsClient

        yandex_key = os.getenv("YANDEX_MAPS_API_KEY")
        client = YandexMapsClient(api_key=yandex_key)

        # Тестируем получение снимка
        print("\nПолучение спутникового снимка центра СПб...")
        lat, lon = 59.9311, 30.3609

        image_data = client.get_satellite_image(
            lat=lat,
            lon=lon,
            zoom=15,
            width=400,
            height=300
        )

        if image_data and len(image_data) > 1000:
            print("✓ Yandex Maps API доступен!")
            print(f"  Размер изображения: {len(image_data)} байт")
            if yandex_key:
                print("  API ключ: используется")
            else:
                print("  API ключ: не установлен (работает без ключа)")
            return True
        else:
            print("✗ Не удалось получить изображение")
            return False

    except Exception as e:
        print(f"✗ Ошибка Yandex Maps API: {e}")
        return False


def test_claude_vision_api():
    """Тест доступности Claude Vision API"""
    print("\n" + "="*60)
    print("ТЕСТ 3: Claude Vision API")
    print("="*60)

    try:
        from claude_vision_client import ClaudeVisionClient
        from PIL import Image, ImageDraw
        from io import BytesIO

        anthropic_key = os.getenv("ANTHROPIC_API_KEY")

        if not anthropic_key:
            print("✗ ANTHROPIC_API_KEY не установлен!")
            print("  Добавьте ключ в файл .env")
            return False

        client = ClaudeVisionClient(api_key=anthropic_key)

        # Создаем тестовое изображение
        print("\nСоздание тестового изображения...")
        img = Image.new('RGB', (400, 300), color='green')
        draw = ImageDraw.Draw(img)
        draw.rectangle([50, 50, 150, 150], fill='brown', outline='black')
        draw.text((200, 150), "Test Plot", fill='white')

        # Конвертируем в байты
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        image_data = buffer.getvalue()

        print("Отправка запроса к Claude Vision API...")
        print("(Это может занять несколько секунд)")

        result = client.analyze_plot_occupancy(
            image_data=image_data,
            plot_details={'cadastral_number': 'TEST:00:0000000:00'}
        )

        if result and 'error' not in result:
            print("✓ Claude Vision API доступен!")
            print(f"  Модель: {client.model}")
            print(f"  Ответ получен: {bool(result.get('description'))}")
            return True
        else:
            print(f"✗ Ошибка в ответе Claude: {result.get('error', 'Unknown')}")
            return False

    except Exception as e:
        print(f"✗ Ошибка Claude Vision API: {e}")
        return False


def test_all():
    """Запустить все тесты"""
    print("\n" + "="*80)
    print(" "*20 + "ТЕСТ ДОСТУПНОСТИ API")
    print("="*80)

    results = {
        'rosreestr': test_rosreestr_api(),
        'yandex_maps': test_yandex_maps_api(),
        'claude_vision': test_claude_vision_api()
    }

    # Итоги
    print("\n" + "="*80)
    print("РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ")
    print("="*80)

    print(f"\n1. Росреестр API:      {'✓ Доступен' if results['rosreestr'] else '✗ Недоступен'}")
    print(f"2. Yandex Maps API:    {'✓ Доступен' if results['yandex_maps'] else '✗ Недоступен'}")
    print(f"3. Claude Vision API:  {'✓ Доступен' if results['claude_vision'] else '✗ Недоступен'}")

    all_passed = all(results.values())

    if all_passed:
        print("\n" + "="*80)
        print("✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Система готова к работе.")
        print("="*80)
        print("\nТеперь вы можете запустить:")
        print("  python example.py     - Примеры использования")
        print("  python pipeline.py    - Полный пайплайн")
    else:
        print("\n" + "="*80)
        print("⚠ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ")
        print("="*80)

        if not results['rosreestr']:
            print("\n- Росреестр API: проверьте интернет-соединение")

        if not results['yandex_maps']:
            print("\n- Yandex Maps API: проверьте интернет-соединение")
            print("  API ключ опционален, должно работать и без него")

        if not results['claude_vision']:
            print("\n- Claude Vision API: проверьте ANTHROPIC_API_KEY в .env")
            print("  Получить ключ: https://console.anthropic.com/")

    return all_passed


if __name__ == "__main__":
    success = test_all()
    exit(0 if success else 1)
