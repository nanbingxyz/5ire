"""
Claude Vision API Client
Анализ спутниковых снимков участков с помощью Claude
"""

import base64
from typing import Dict, Optional, Literal
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
        self.model = "claude-sonnet-4-20250514"  # Актуальная модель с Vision

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

            # Парсим ответ (упрощенная версия)
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
            # Пытаемся извлечь JSON из ответа
            import json
            import re

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

    def analyze_zoning_document(self,
                               image_data: bytes,
                               coordinates: tuple) -> Dict:
        """
        Анализировать документ зонирования (PDF страница с генпланом)

        Args:
            image_data: Изображение страницы генплана
            coordinates: Координаты участка (lat, lon)

        Returns:
            Информация о зонировании
        """
        try:
            image_base64 = base64.b64encode(image_data).decode('utf-8')

            lat, lon = coordinates

            prompt = f"""Это страница из генерального плана Санкт-Петербурга.

Участок находится примерно по координатам: {lat}, {lon}

Определи:
1. Какая функциональная зона на этих координатах?
2. Разрешено ли многоэтажное жилищное строительство в этой зоне?
3. Какие ограничения указаны для этой зоны?

Ответь в формате JSON с ключами:
- zone_type (string)
- multistory_allowed (boolean)
- restrictions (string)
- confidence (string)
"""

            message = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
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

            response_text = message.content[0].text
            result = self._parse_response(response_text)

            return result

        except Exception as e:
            logger.error(f"Error analyzing zoning document: {e}")
            return {'error': str(e)}


# Пример использования
if __name__ == "__main__":
    import os
    from loguru import logger

    logger.add("claude_vision_client.log", rotation="10 MB")

    # Получаем API ключ из переменных окружения
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        logger.error("ANTHROPIC_API_KEY not found in environment")
        exit(1)

    client = ClaudeVisionClient(api_key=api_key)

    # Пример: анализ тестового изображения
    test_image_path = "test_satellite.png"

    if os.path.exists(test_image_path):
        with open(test_image_path, 'rb') as f:
            image_data = f.read()

        plot_details = {
            'cadastral_number': '78:12:1234567:890',
            'area': 5000,
            'area_unit': 'м²',
            'category': 'Земли населенных пунктов',
            'permitted_use': 'Для жилищного строительства',
            'address': 'Санкт-Петербург, район Приморский'
        }

        result = client.analyze_plot_occupancy(
            image_data=image_data,
            plot_details=plot_details
        )

        logger.info(f"Analysis result: {result}")
    else:
        logger.warning(f"Test image not found: {test_image_path}")
