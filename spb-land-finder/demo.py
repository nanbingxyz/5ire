"""
Демо: Анализ участка с использованием готового снимка
Работает без доступа к Rosreestr и Yandex Maps API
"""

import os
import json
from dotenv import load_dotenv
from loguru import logger
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

from claude_vision_client import ClaudeVisionClient
from config import config

# Загружаем переменные окружения
load_dotenv()


def create_demo_satellite_image(occupied: bool = False) -> bytes:
    """
    Создать демонстрационное изображение участка

    Args:
        occupied: True - с застройкой, False - свободный

    Returns:
        Байты PNG изображения
    """
    # Создаем изображение 800x600
    img = Image.new('RGB', (800, 600), color='#228B22')  # Зеленый фон (трава)
    draw = ImageDraw.Draw(img)

    if occupied:
        # Рисуем здания
        # Здание 1
        draw.rectangle([100, 150, 250, 350], fill='#8B4513', outline='#654321', width=2)
        draw.rectangle([110, 160, 140, 190], fill='#87CEEB')  # Окно
        draw.rectangle([180, 160, 210, 190], fill='#87CEEB')  # Окно
        draw.rectangle([110, 220, 140, 250], fill='#87CEEB')  # Окно
        draw.rectangle([180, 220, 210, 250], fill='#87CEEB')  # Окно

        # Здание 2
        draw.rectangle([500, 200, 700, 450], fill='#A0522D', outline='#8B4513', width=2)
        draw.rectangle([520, 220, 560, 260], fill='#B0E0E6')  # Окно
        draw.rectangle([590, 220, 630, 260], fill='#B0E0E6')  # Окно
        draw.rectangle([520, 290, 560, 330], fill='#B0E0E6')  # Окно
        draw.rectangle([590, 290, 630, 330], fill='#B0E0E6')  # Окно

        # Дорога
        draw.rectangle([0, 500, 800, 600], fill='#696969')
        draw.line([(0, 550), (800, 550)], fill='#FFFF00', width=3)  # Разметка

        logger.info("Created demo image: occupied plot with buildings")
    else:
        # Свободный участок - только зелень и немного деревьев
        for i in range(15):
            x = 50 + i * 50
            y = 100 + (i % 3) * 150
            # Рисуем деревья (круги)
            draw.ellipse([x-15, y-15, x+15, y+15], fill='#006400', outline='#004d00')
            draw.rectangle([x-5, y+15, x+5, y+35], fill='#654321')  # Ствол

        # Небольшая тропинка
        draw.rectangle([350, 0, 400, 600], fill='#8B7355', outline='#654321')

        logger.info("Created demo image: vacant plot with vegetation")

    # Сохраняем в байты
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


def demo_analyze_vacant_plot():
    """Демо: анализ свободного участка"""

    print("\n" + "="*70)
    print("ДЕМО 1: Анализ свободного участка")
    print("="*70 + "\n")

    # Создаем клиент Claude
    client = ClaudeVisionClient(api_key=config.ANTHROPIC_API_KEY)

    # Создаем демо-изображение свободного участка
    print("Создание демо-изображения свободного участка...")
    image_data = create_demo_satellite_image(occupied=False)

    # Сохраняем для просмотра
    os.makedirs("output/demo", exist_ok=True)
    with open("output/demo/vacant_plot.png", "wb") as f:
        f.write(image_data)
    print(f"✓ Изображение сохранено: output/demo/vacant_plot.png")

    # Данные об участке
    plot_details = {
        'cadastral_number': 'DEMO:78:12:0000001:01',
        'area': 5000,
        'area_unit': 'м²',
        'category': 'Земли населенных пунктов',
        'permitted_use': 'Для многоэтажного жилищного строительства',
        'address': 'Санкт-Петербург, Приморский район (ДЕМО)'
    }

    # Анализируем
    print("\nАнализ участка через Claude Vision API...")
    print("(Подождите несколько секунд)")

    result = client.analyze_plot_occupancy(
        image_data=image_data,
        plot_details=plot_details
    )

    # Выводим результаты
    print("\n" + "="*70)
    print("РЕЗУЛЬТАТЫ АНАЛИЗА")
    print("="*70)

    print(f"\n📍 Кадастровый номер: {plot_details['cadastral_number']}")
    print(f"📐 Площадь: {plot_details['area']} {plot_details['area_unit']}")
    print(f"📋 Категория: {plot_details['category']}")
    print(f"🏗️  Разрешенное использование: {plot_details['permitted_use']}")

    print(f"\n🔍 Анализ застройки:")
    print(f"   Застроен: {'❌ НЕТ' if not result.get('is_occupied') else '✅ ДА'}")
    print(f"   Уверенность: {result.get('confidence', 'N/A')}")
    print(f"   Обнаружены здания: {'❌ НЕТ' if not result.get('buildings_detected') else '✅ ДА'}")
    print(f"   Пригоден для застройки: {'✅ ДА' if result.get('suitable_for_development') else '❌ НЕТ'}")

    print(f"\n📝 Описание:")
    print(f"   {result.get('description', 'N/A')[:300]}...")

    print(f"\n💡 Рекомендации:")
    print(f"   {result.get('recommendations', 'N/A')}")

    # Сохраняем результат
    result_data = {
        'plot_details': plot_details,
        'analysis': result
    }

    with open("output/demo/vacant_plot_result.json", "w", encoding='utf-8') as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Результат сохранен: output/demo/vacant_plot_result.json")

    return result


def demo_analyze_occupied_plot():
    """Демо: анализ застроенного участка"""

    print("\n" + "="*70)
    print("ДЕМО 2: Анализ застроенного участка")
    print("="*70 + "\n")

    # Создаем клиент Claude
    client = ClaudeVisionClient(api_key=config.ANTHROPIC_API_KEY)

    # Создаем демо-изображение застроенного участка
    print("Создание демо-изображения застроенного участка...")
    image_data = create_demo_satellite_image(occupied=True)

    # Сохраняем для просмотра
    os.makedirs("output/demo", exist_ok=True)
    with open("output/demo/occupied_plot.png", "wb") as f:
        f.write(image_data)
    print(f"✓ Изображение сохранено: output/demo/occupied_plot.png")

    # Данные об участке
    plot_details = {
        'cadastral_number': 'DEMO:78:12:0000002:01',
        'area': 3500,
        'area_unit': 'м²',
        'category': 'Земли населенных пунктов',
        'permitted_use': 'Многоэтажная жилая застройка',
        'address': 'Санкт-Петербург, Центральный район (ДЕМО)'
    }

    # Анализируем
    print("\nАнализ участка через Claude Vision API...")
    print("(Подождите несколько секунд)")

    result = client.analyze_plot_occupancy(
        image_data=image_data,
        plot_details=plot_details
    )

    # Выводим результаты
    print("\n" + "="*70)
    print("РЕЗУЛЬТАТЫ АНАЛИЗА")
    print("="*70)

    print(f"\n📍 Кадастровый номер: {plot_details['cadastral_number']}")
    print(f"📐 Площадь: {plot_details['area']} {plot_details['area_unit']}")

    print(f"\n🔍 Анализ застройки:")
    print(f"   Застроен: {'❌ НЕТ' if not result.get('is_occupied') else '✅ ДА'}")
    print(f"   Уверенность: {result.get('confidence', 'N/A')}")
    print(f"   Обнаружены здания: {'❌ НЕТ' if not result.get('buildings_detected') else '✅ ДА'}")
    print(f"   Пригоден для застройки: {'✅ ДА' if result.get('suitable_for_development') else '❌ НЕТ'}")

    print(f"\n📝 Описание:")
    print(f"   {result.get('description', 'N/A')[:300]}...")

    # Сохраняем результат
    result_data = {
        'plot_details': plot_details,
        'analysis': result
    }

    with open("output/demo/occupied_plot_result.json", "w", encoding='utf-8') as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Результат сохранен: output/demo/occupied_plot_result.json")

    return result


def main():
    """Запуск демонстрации"""

    logger.add("output/demo/demo.log", rotation="10 MB", level="INFO")

    print("\n" + "="*70)
    print("  ДЕМОНСТРАЦИЯ URBAN PLOT ANALYSIS")
    print("  AI-анализ застройки земельных участков")
    print("="*70)

    # Проверка API ключа
    try:
        config.validate()
        print(f"\n✓ API ключ Claude: установлен")
    except ValueError as e:
        print(f"\n✗ Ошибка: {e}")
        print("\nСоздайте файл .env и добавьте ANTHROPIC_API_KEY")
        return

    print("\nЭто демо работает БЕЗ доступа к Rosreestr и Yandex Maps API.")
    print("Используются синтетические изображения для демонстрации возможностей.")

    # Запускаем демо
    print("\n" + "="*70)

    # Демо 1: Свободный участок
    result1 = demo_analyze_vacant_plot()

    input("\n\nНажмите Enter для продолжения...")

    # Демо 2: Застроенный участок
    result2 = demo_analyze_occupied_plot()

    # Итоги
    print("\n" + "="*70)
    print("ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА")
    print("="*70)

    print("\nРезультаты сохранены в директории: output/demo/")
    print("- vacant_plot.png - Изображение свободного участка")
    print("- vacant_plot_result.json - Результат анализа свободного участка")
    print("- occupied_plot.png - Изображение застроенного участка")
    print("- occupied_plot_result.json - Результат анализа застроенного участка")

    print("\n" + "="*70)
    print("КАК РАБОТАЕТ СИСТЕМА:")
    print("="*70)
    print("""
1. Спутниковый снимок участка → Claude Vision API
2. AI анализирует изображение и определяет:
   - Наличие зданий и построек
   - Уровень растительности
   - Пригодность для строительства
3. Результат: застроен/свободен + уверенность + рекомендации

В production версии:
- Реальные спутниковые снимки из Yandex/Google Maps
- Кадастровые данные из Росреестра
- Данные о зонировании из генплана СПб
- Автоматическая фильтрация по критериям
    """)

    print("\n✓ Демонстрация успешно завершена!")


if __name__ == "__main__":
    main()
