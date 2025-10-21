"""
Comprehensive Research: Finding Available Plots for Multi-Story Construction in Saint Petersburg

Этот скрипт проводит полное исследование доступных участков в Санкт-Петербурге
для многоэтажного строительства с использованием веб-поиска и AI-анализа.
"""

import os
import json
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv
from anthropic import Anthropic
from loguru import logger

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logger.add("output/research.log", rotation="10 MB", level="INFO")


class UrbanPlotResearcher:
    """Исследователь земельных участков для строительства"""

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
        """
        Провести комплексное исследование доступных участков

        Returns:
            Детальный отчет с источниками
        """
        logger.info("Starting comprehensive research on available plots in Saint Petersburg")

        # Формируем детальный промпт для Claude
        research_prompt = """Задача: Найти свободный участок для строительства многоэтажного дома в Санкт-Петербурге.

Мне нужен конкретный и полный ответ на эту задачу со ссылками на источники.

Пожалуйста, предоставь:

1. **КОНКРЕТНЫЕ УЧАСТКИ**:
   - Районы Санкт-Петербурга, где есть доступные участки под застройку
   - Примерные адреса или локации
   - Площади участков
   - Актуальная информация о доступности

2. **ОФИЦИАЛЬНЫЕ ИСТОЧНИКИ ДАННЫХ**:
   - Где искать информация об участках (официальные порталы)
   - Публичная кадастровая карта - как пользоваться
   - Градостроительный портал СПб
   - Аукционы земельных участков

3. **КРИТЕРИИ ПОДБОРА**:
   - Зонирование: какие зоны разрешают многоэтажное строительство
   - Минимальная площадь участка для многоэтажки
   - Требования к инфраструктуре
   - Ограничения по высотности в разных районах

4. **ПРОЦЕСС ПОЛУЧЕНИЯ**:
   - Как получить участок (аукцион, прямая покупка, аренда)
   - Какие документы нужны
   - Куда обращаться

5. **ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ**:
   - В каких районах проще получить участок
   - Примерная стоимость
   - Сроки оформления

6. **ИСТОЧНИКИ**:
   - Конкретные URL официальных порталов
   - Нормативные документы
   - Контакты ответственных организаций

Формат ответа: детальный структурированный отчет с конкретными ссылками на каждый источник.
Используй актуальную информацию 2025 года."""

        try:
            logger.info("Sending research request to Claude Sonnet 4.5")

            # Отправляем запрос Claude
            message = self.client.messages.create(
                model=self.model,
                max_tokens=8000,
                messages=[
                    {
                        "role": "user",
                        "content": research_prompt
                    }
                ]
            )

            # Получаем ответ
            response_text = message.content[0].text
            logger.info(f"Received response from Claude, length: {len(response_text)} chars")

            # Сохраняем результат
            self.research_data['claude_analysis'] = response_text
            self.research_data['model_used'] = self.model
            self.research_data['usage'] = {
                'input_tokens': message.usage.input_tokens,
                'output_tokens': message.usage.output_tokens
            }

            return self.research_data

        except Exception as e:
            logger.error(f"Error during research: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }

    def save_report(self, report_data: Dict, filename: str = None):
        """Сохранить отчет в файл"""
        if filename is None:
            filename = f"output/research_report_{int(datetime.now().timestamp())}.json"

        os.makedirs("output", exist_ok=True)

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Report saved to {filename}")
        return filename

    def save_markdown_report(self, report_data: Dict, filename: str = None):
        """Сохранить отчет в Markdown формате"""
        if filename is None:
            filename = f"output/research_report_{int(datetime.now().timestamp())}.md"

        os.makedirs("output", exist_ok=True)

        # Формируем Markdown
        markdown_content = f"""# Исследование: Поиск участка для многоэтажного строительства в Санкт-Петербурге

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
    """Главная функция - запуск исследования"""

    print("\n" + "="*80)
    print(" "*15 + "ПОИСК УЧАСТКА ДЛЯ МНОГОЭТАЖНОГО СТРОИТЕЛЬСТВА")
    print(" "*25 + "Санкт-Петербург, 2025")
    print("="*80 + "\n")

    # Получаем API ключ
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        print("✗ ОШИБКА: ANTHROPIC_API_KEY не найден в .env файле")
        return

    print("✓ API ключ найден")
    print("✓ Модель: Claude Sonnet 4.5\n")

    # Создаем исследователя
    researcher = UrbanPlotResearcher(api_key=api_key)

    print("Начинаем комплексное исследование...")
    print("Это может занять 30-60 секунд...\n")

    # Проводим исследование
    report = researcher.research_available_plots()

    if 'error' in report:
        print(f"\n✗ Ошибка при исследовании: {report['error']}")
        return

    # Сохраняем отчеты
    print("\n" + "="*80)
    print("ИССЛЕДОВАНИЕ ЗАВЕРШЕНО")
    print("="*80 + "\n")

    json_file = researcher.save_report(report)
    md_file = researcher.save_markdown_report(report)

    print(f"✓ Отчет сохранен:")
    print(f"  - JSON: {json_file}")
    print(f"  - Markdown: {md_file}\n")

    # Выводим краткую версию в консоль
    print("="*80)
    print("РЕЗУЛЬТАТЫ ИССЛЕДОВАНИЯ")
    print("="*80 + "\n")

    analysis = report.get('claude_analysis', '')

    # Выводим первые 2000 символов
    if len(analysis) > 2000:
        print(analysis[:2000])
        print(f"\n... (еще {len(analysis) - 2000} символов)")
        print(f"\nПолный отчет доступен в файле: {md_file}")
    else:
        print(analysis)

    print("\n" + "="*80)
    print(f"Использовано токенов: {report.get('usage', {}).get('input_tokens', 0)} input / {report.get('usage', {}).get('output_tokens', 0)} output")
    print("="*80 + "\n")

    print("✓ Для просмотра полного отчета откройте файл:")
    print(f"  {md_file}")
    print()


if __name__ == "__main__":
    main()
