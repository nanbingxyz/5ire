"""
Urban Plot Analysis Pipeline
Основной пайплайн для поиска свободных участков под многоэтажное строительство
"""

import os
import json
import time
from typing import List, Dict, Optional
from datetime import datetime
from loguru import logger

from rosreestr_client import RosreestrClient
from yandex_maps_client import YandexMapsClient
from claude_vision_client import ClaudeVisionClient


class UrbanPlotAnalysisPipeline:
    """Пайплайн анализа городских участков"""

    def __init__(self,
                 anthropic_api_key: str,
                 yandex_api_key: Optional[str] = None,
                 output_dir: str = "output"):
        """
        Args:
            anthropic_api_key: API ключ Anthropic Claude
            yandex_api_key: API ключ Yandex Maps (опционально)
            output_dir: Директория для сохранения результатов
        """
        self.rosreestr = RosreestrClient()
        self.yandex_maps = YandexMapsClient(api_key=yandex_api_key)
        self.claude = ClaudeVisionClient(api_key=anthropic_api_key)

        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(f"{output_dir}/images", exist_ok=True)

        # Настройка логирования
        logger.add(
            f"{output_dir}/pipeline.log",
            rotation="10 MB",
            level="INFO"
        )

        logger.info("Pipeline initialized")

    def analyze_single_plot(self,
                           cadastral_number: Optional[str] = None,
                           lat: Optional[float] = None,
                           lon: Optional[float] = None) -> Dict:
        """
        Анализ одного участка

        Args:
            cadastral_number: Кадастровый номер ИЛИ
            lat, lon: Координаты участка

        Returns:
            Результат анализа
        """
        try:
            logger.info(f"Starting analysis for plot: {cadastral_number or f'({lat}, {lon})'}")

            # 1. Получаем данные об участке из Росреестра
            if cadastral_number:
                plot_data = self.rosreestr.get_plot_by_cadastral_number(cadastral_number)
            elif lat and lon:
                plot_data = self.rosreestr.get_plot_by_coordinates(lat, lon)
            else:
                raise ValueError("Either cadastral_number or (lat, lon) must be provided")

            if not plot_data:
                logger.warning("Plot not found in Rosreestr")
                return {'status': 'not_found', 'error': 'Plot not found in cadastral registry'}

            # Извлекаем детали участка
            plot_details = self.rosreestr.get_plot_details(plot_data)
            coords = self.rosreestr.get_plot_coordinates(plot_data)

            if not coords:
                logger.warning("Could not extract coordinates from plot data")
                return {'status': 'error', 'error': 'Could not extract coordinates'}

            lat, lon = coords
            logger.info(f"Plot found at coordinates: ({lat}, {lon})")
            logger.info(f"Plot details: {plot_details}")

            # 2. Получаем спутниковый снимок
            image_filename = f"plot_{plot_details.get('cadastral_number', 'unknown').replace(':', '_')}.png"
            image_path = f"{self.output_dir}/images/{image_filename}"

            logger.info(f"Fetching satellite image...")
            image_data = self.yandex_maps.get_satellite_image(
                lat=lat,
                lon=lon,
                zoom=18,
                width=800,
                height=600,
                save_path=image_path
            )

            if not image_data:
                logger.error("Failed to get satellite image")
                return {
                    'status': 'error',
                    'error': 'Failed to get satellite image',
                    'plot_details': plot_details
                }

            # Небольшая задержка чтобы не перегружать API
            time.sleep(1)

            # 3. Анализируем снимок через Claude Vision
            logger.info("Analyzing satellite image with Claude Vision...")
            analysis_result = self.claude.analyze_plot_occupancy(
                image_data=image_data,
                plot_details=plot_details
            )

            # 4. Формируем итоговый результат
            result = {
                'status': 'success',
                'timestamp': datetime.now().isoformat(),
                'plot_details': plot_details,
                'coordinates': {'lat': lat, 'lon': lon},
                'satellite_image': image_path,
                'analysis': analysis_result
            }

            # Сохраняем результат
            self._save_result(result, cadastral_number or f"{lat}_{lon}")

            logger.info(f"Analysis complete. Is occupied: {analysis_result.get('is_occupied')}")

            return result

        except Exception as e:
            logger.error(f"Error in analyze_single_plot: {e}")
            return {'status': 'error', 'error': str(e)}

    def analyze_area(self,
                    min_lat: float,
                    min_lon: float,
                    max_lat: float,
                    max_lon: float,
                    max_plots: int = 10) -> List[Dict]:
        """
        Анализ всех участков в заданной области

        Args:
            min_lat: Минимальная широта
            min_lon: Минимальная долгота
            max_lat: Максимальная широта
            max_lon: Максимальная долгота
            max_plots: Максимальное количество участков для анализа

        Returns:
            Список результатов анализа
        """
        try:
            logger.info(f"Searching plots in area: ({min_lat}, {min_lon}) - ({max_lat}, {max_lon})")

            # 1. Получаем список участков в области
            plots = self.rosreestr.search_plots_in_area(
                min_lat=min_lat,
                min_lon=min_lon,
                max_lat=max_lat,
                max_lon=max_lon,
                limit=max_plots
            )

            logger.info(f"Found {len(plots)} plots in area")

            results = []

            # 2. Анализируем каждый участок
            for i, plot in enumerate(plots[:max_plots]):
                logger.info(f"Processing plot {i+1}/{min(len(plots), max_plots)}")

                coords = self.rosreestr.get_plot_coordinates(plot)
                if not coords:
                    logger.warning(f"Skipping plot {i+1}: no coordinates")
                    continue

                lat, lon = coords

                # Анализируем участок
                result = self.analyze_single_plot(lat=lat, lon=lon)
                results.append(result)

                # Задержка между запросами
                time.sleep(2)

            # 3. Фильтруем свободные участки
            vacant_plots = [
                r for r in results
                if r.get('status') == 'success' and
                not r.get('analysis', {}).get('is_occupied', True)
            ]

            logger.info(f"Analysis complete. Found {len(vacant_plots)} potentially vacant plots")

            # Сохраняем сводный отчет
            self._save_area_report(results, vacant_plots)

            return results

        except Exception as e:
            logger.error(f"Error in analyze_area: {e}")
            return []

    def find_suitable_plots(self,
                          min_lat: float,
                          min_lon: float,
                          max_lat: float,
                          max_lon: float,
                          min_area: float = 1000,
                          max_plots: int = 20) -> List[Dict]:
        """
        Найти подходящие участки для многоэтажного строительства

        Args:
            min_lat, min_lon, max_lat, max_lon: Границы области
            min_area: Минимальная площадь участка (м²)
            max_plots: Максимальное количество участков

        Returns:
            Список подходящих участков
        """
        logger.info("Starting search for suitable plots...")

        # Анализируем все участки в области
        all_results = self.analyze_area(
            min_lat=min_lat,
            min_lon=min_lon,
            max_lat=max_lat,
            max_lon=max_lon,
            max_plots=max_plots
        )

        # Фильтруем по критериям
        suitable_plots = []

        for result in all_results:
            if result.get('status') != 'success':
                continue

            plot_details = result.get('plot_details', {})
            analysis = result.get('analysis', {})

            # Критерии отбора
            is_vacant = not analysis.get('is_occupied', True)
            has_sufficient_area = plot_details.get('area', 0) >= min_area
            is_suitable = analysis.get('suitable_for_development', False)

            if is_vacant and has_sufficient_area:
                result['suitability_score'] = self._calculate_suitability_score(result)
                suitable_plots.append(result)

        # Сортируем по оценке пригодности
        suitable_plots.sort(key=lambda x: x.get('suitability_score', 0), reverse=True)

        logger.info(f"Found {len(suitable_plots)} suitable plots")

        # Сохраняем отчет
        self._save_suitable_plots_report(suitable_plots)

        return suitable_plots

    def _calculate_suitability_score(self, result: Dict) -> float:
        """
        Рассчитать оценку пригодности участка (0-100)

        Args:
            result: Результат анализа

        Returns:
            Оценка от 0 до 100
        """
        score = 0.0

        analysis = result.get('analysis', {})
        plot_details = result.get('plot_details', {})

        # Уверенность анализа
        confidence_map = {'высокий': 30, 'средний': 20, 'низкий': 10}
        score += confidence_map.get(analysis.get('confidence', 'низкий'), 10)

        # Площадь участка (больше = лучше, до определенного предела)
        area = plot_details.get('area', 0)
        if area >= 5000:
            score += 30
        elif area >= 2000:
            score += 20
        elif area >= 1000:
            score += 10

        # Отсутствие построек
        if not analysis.get('buildings_detected', True):
            score += 20

        # Пригодность для застройки
        if analysis.get('suitable_for_development', False):
            score += 20

        return min(score, 100)

    def _save_result(self, result: Dict, identifier: str):
        """Сохранить результат анализа в JSON"""
        safe_id = identifier.replace(':', '_').replace('/', '_')
        filename = f"{self.output_dir}/result_{safe_id}.json"

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        logger.info(f"Result saved to {filename}")

    def _save_area_report(self, all_results: List[Dict], vacant_plots: List[Dict]):
        """Сохранить отчет по области"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_plots_analyzed': len(all_results),
            'vacant_plots_found': len(vacant_plots),
            'success_rate': len([r for r in all_results if r.get('status') == 'success']) / len(all_results) if all_results else 0,
            'all_results': all_results,
            'vacant_plots': vacant_plots
        }

        filename = f"{self.output_dir}/area_report_{int(time.time())}.json"

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        logger.info(f"Area report saved to {filename}")

    def _save_suitable_plots_report(self, suitable_plots: List[Dict]):
        """Сохранить отчет по подходящим участкам"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_suitable_plots': len(suitable_plots),
            'plots': suitable_plots
        }

        filename = f"{self.output_dir}/suitable_plots_{int(time.time())}.json"

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        logger.info(f"Suitable plots report saved to {filename}")
        logger.info(f"\nTop 5 suitable plots:")
        for i, plot in enumerate(suitable_plots[:5]):
            logger.info(f"{i+1}. Cadastral: {plot.get('plot_details', {}).get('cadastral_number')}, "
                       f"Score: {plot.get('suitability_score', 0):.1f}, "
                       f"Area: {plot.get('plot_details', {}).get('area')} m²")


# Пример использования
if __name__ == "__main__":
    from dotenv import load_dotenv

    # Загружаем переменные окружения
    load_dotenv()

    # Получаем API ключи
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    yandex_key = os.getenv("YANDEX_MAPS_API_KEY")  # Опционально

    if not anthropic_key:
        logger.error("ANTHROPIC_API_KEY not found in environment variables")
        exit(1)

    # Создаем пайплайн
    pipeline = UrbanPlotAnalysisPipeline(
        anthropic_api_key=anthropic_key,
        yandex_api_key=yandex_key,
        output_dir="output"
    )

    # Пример 1: Анализ одного участка по координатам
    logger.info("=== Example 1: Single plot analysis ===")
    result = pipeline.analyze_single_plot(
        lat=59.9311,
        lon=30.3609
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # Пример 2: Поиск подходящих участков в области
    # Координаты примерной области в Санкт-Петербурге
    logger.info("\n=== Example 2: Area analysis ===")
    suitable_plots = pipeline.find_suitable_plots(
        min_lat=59.90,
        min_lon=30.30,
        max_lat=59.95,
        max_lon=30.40,
        min_area=2000,  # Минимум 2000 м²
        max_plots=5  # Для примера анализируем только 5 участков
    )

    print(f"\nFound {len(suitable_plots)} suitable plots")
