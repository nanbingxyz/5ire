"""
Пример использования Urban Plot Analysis Pipeline
Простой скрипт для быстрого старта
"""

import os
import json
from dotenv import load_dotenv
from loguru import logger

from pipeline import UrbanPlotAnalysisPipeline
from config import config

# Настройка логирования
logger.add("example.log", rotation="10 MB", level="INFO")


def example_single_plot_by_coordinates():
    """Пример 1: Анализ одного участка по координатам"""

    print("\n" + "="*60)
    print("ПРИМЕР 1: Анализ участка по координатам")
    print("="*60 + "\n")

    pipeline = UrbanPlotAnalysisPipeline(
        anthropic_api_key=config.ANTHROPIC_API_KEY,
        yandex_api_key=config.YANDEX_MAPS_API_KEY,
        output_dir=config.OUTPUT_DIR
    )

    # Координаты примерного участка в Санкт-Петербурге
    # Можно заменить на реальные координаты
    lat = 59.9311
    lon = 30.3609

    print(f"Анализируем участок по координатам: ({lat}, {lon})")

    result = pipeline.analyze_single_plot(lat=lat, lon=lon)

    if result.get('status') == 'success':
        print("\n✓ Анализ успешно завершен!")
        print(f"\nКадастровый номер: {result['plot_details'].get('cadastral_number', 'N/A')}")
        print(f"Площадь: {result['plot_details'].get('area', 'N/A')} {result['plot_details'].get('area_unit', '')}")
        print(f"Адрес: {result['plot_details'].get('address', 'N/A')}")
        print(f"\nЗастроен: {'Да' if result['analysis'].get('is_occupied') else 'Нет'}")
        print(f"Уверенность: {result['analysis'].get('confidence', 'N/A')}")
        print(f"Описание: {result['analysis'].get('description', 'N/A')[:200]}...")
        print(f"\nСпутниковый снимок сохранен: {result.get('satellite_image')}")
    else:
        print(f"\n✗ Ошибка: {result.get('error', 'Unknown error')}")

    return result


def example_single_plot_by_cadastral():
    """Пример 2: Анализ участка по кадастровому номеру"""

    print("\n" + "="*60)
    print("ПРИМЕР 2: Анализ участка по кадастровому номеру")
    print("="*60 + "\n")

    pipeline = UrbanPlotAnalysisPipeline(
        anthropic_api_key=config.ANTHROPIC_API_KEY,
        yandex_api_key=config.YANDEX_MAPS_API_KEY,
        output_dir=config.OUTPUT_DIR
    )

    # ВАЖНО: Замените на реальный кадастровый номер участка в СПб
    # Формат: XX:XX:XXXXXXX:XX
    cadastral_number = "78:34:0005678:123"  # Пример, нужен реальный номер

    print(f"Анализируем участок с кадастровым номером: {cadastral_number}")
    print("(Если участок не найден - замените на реальный номер)")

    result = pipeline.analyze_single_plot(cadastral_number=cadastral_number)

    if result.get('status') == 'success':
        print("\n✓ Анализ успешно завершен!")
        print(f"\nПлощадь: {result['plot_details'].get('area')} м²")
        print(f"Категория: {result['plot_details'].get('category')}")
        print(f"Застроен: {'Да' if result['analysis'].get('is_occupied') else 'Нет'}")
    elif result.get('status') == 'not_found':
        print(f"\n⚠ Участок не найден в кадастре")
        print("Используйте реальный кадастровый номер участка в Санкт-Петербурге")
    else:
        print(f"\n✗ Ошибка: {result.get('error')}")

    return result


def example_area_search():
    """Пример 3: Поиск участков в области"""

    print("\n" + "="*60)
    print("ПРИМЕР 3: Поиск участков в области")
    print("="*60 + "\n")

    pipeline = UrbanPlotAnalysisPipeline(
        anthropic_api_key=config.ANTHROPIC_API_KEY,
        yandex_api_key=config.YANDEX_MAPS_API_KEY,
        output_dir=config.OUTPUT_DIR
    )

    # Небольшая область в Приморском районе СПб (пример)
    # Можно заменить на любую интересующую область
    min_lat = 59.95
    min_lon = 30.20
    max_lat = 59.97
    max_lon = 30.25

    print(f"Поиск участков в области:")
    print(f"  От: ({min_lat}, {min_lon})")
    print(f"  До: ({max_lat}, {max_lon})")
    print(f"  Макс. участков: 3 (для примера)")

    results = pipeline.analyze_area(
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        max_plots=3  # Для примера анализируем только 3 участка
    )

    print(f"\n✓ Анализ завершен. Обработано участков: {len(results)}")

    vacant_count = sum(1 for r in results
                      if r.get('status') == 'success'
                      and not r.get('analysis', {}).get('is_occupied', True))

    print(f"Свободных участков: {vacant_count}")

    return results


def example_find_suitable_plots():
    """Пример 4: Поиск подходящих участков с фильтрацией"""

    print("\n" + "="*60)
    print("ПРИМЕР 4: Поиск подходящих участков для строительства")
    print("="*60 + "\n")

    pipeline = UrbanPlotAnalysisPipeline(
        anthropic_api_key=config.ANTHROPIC_API_KEY,
        yandex_api_key=config.YANDEX_MAPS_API_KEY,
        output_dir=config.OUTPUT_DIR
    )

    # Область для поиска
    min_lat = 59.90
    min_lon = 30.30
    max_lat = 59.95
    max_lon = 30.40

    # Критерии фильтрации
    min_area = 2000  # Минимум 2000 м²
    max_plots = 5    # Анализируем 5 участков для примера

    print(f"Критерии поиска:")
    print(f"  Минимальная площадь: {min_area} м²")
    print(f"  Максимум участков: {max_plots}")
    print(f"  Область: ({min_lat}, {min_lon}) - ({max_lat}, {max_lon})")

    suitable_plots = pipeline.find_suitable_plots(
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        min_area=min_area,
        max_plots=max_plots
    )

    print(f"\n✓ Найдено подходящих участков: {len(suitable_plots)}")

    if suitable_plots:
        print("\nТоп-3 участка по оценке пригодности:\n")
        for i, plot in enumerate(suitable_plots[:3], 1):
            details = plot.get('plot_details', {})
            analysis = plot.get('analysis', {})
            score = plot.get('suitability_score', 0)

            print(f"{i}. Кадастровый номер: {details.get('cadastral_number', 'N/A')}")
            print(f"   Площадь: {details.get('area', 0)} м²")
            print(f"   Оценка пригодности: {score:.1f}/100")
            print(f"   Застроен: {'Да' if analysis.get('is_occupied') else 'Нет'}")
            print(f"   Уверенность: {analysis.get('confidence', 'N/A')}")
            print(f"   Адрес: {details.get('address', 'N/A')}")
            print()

    return suitable_plots


def main():
    """Главная функция - запуск примеров"""

    # Загружаем переменные окружения
    load_dotenv()

    # Проверяем конфигурацию
    try:
        config.validate()
        print("✓ Конфигурация валидна")
        print(f"API ключ Anthropic: {'установлен' if config.ANTHROPIC_API_KEY else 'НЕ УСТАНОВЛЕН'}")
        print(f"API ключ Yandex: {'установлен' if config.YANDEX_MAPS_API_KEY else 'не установлен (опционально)'}")
    except ValueError as e:
        print(f"\n✗ Ошибка конфигурации: {e}")
        print("\nИнструкция:")
        print("1. Скопируйте .env.example в .env")
        print("2. Добавьте ваш ANTHROPIC_API_KEY в файл .env")
        print("3. Запустите скрипт снова")
        return

    # Меню выбора примера
    print("\n" + "="*60)
    print("URBAN PLOT ANALYSIS - ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ")
    print("="*60)
    print("\nВыберите пример для запуска:")
    print("1. Анализ участка по координатам")
    print("2. Анализ участка по кадастровому номеру")
    print("3. Поиск участков в области")
    print("4. Поиск подходящих участков (с фильтрацией)")
    print("5. Запустить все примеры")
    print("0. Выход")

    choice = input("\nВведите номер (0-5): ").strip()

    if choice == "1":
        example_single_plot_by_coordinates()
    elif choice == "2":
        example_single_plot_by_cadastral()
    elif choice == "3":
        example_area_search()
    elif choice == "4":
        example_find_suitable_plots()
    elif choice == "5":
        print("\nЗапуск всех примеров...\n")
        example_single_plot_by_coordinates()
        # example_single_plot_by_cadastral()  # Требует реальный кадастровый номер
        example_area_search()
        example_find_suitable_plots()
    elif choice == "0":
        print("Выход.")
        return
    else:
        print("Неверный выбор.")
        return

    print("\n" + "="*60)
    print("ГОТОВО!")
    print("="*60)
    print(f"\nРезультаты сохранены в директорию: {config.OUTPUT_DIR}/")
    print("- Спутниковые снимки: output/images/")
    print("- JSON результаты: output/*.json")
    print("- Логи: output/pipeline.log")


if __name__ == "__main__":
    main()
