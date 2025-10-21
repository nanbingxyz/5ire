# Urban Plot Analysis for Saint Petersburg

Прототип системы для автоматического поиска свободных участков под многоэтажное строительство в Санкт-Петербурге.

## Описание

Система использует комбинацию API и AI для анализа земельных участков:

1. **Кадастровые данные** - получение информации об участках через API Росреестра (ПКК)
2. **Спутниковые снимки** - получение актуальных изображений через Yandex Maps Static API
3. **AI-анализ** - определение застройки через Claude Vision API

## Архитектура

```
┌─────────────────┐
│  Росреестр API  │ ──> Кадастровые данные (площадь, категория, адрес)
└─────────────────┘
         │
         ↓
┌─────────────────┐
│ Yandex Maps API │ ──> Спутниковые снимки участка
└─────────────────┘
         │
         ↓
┌─────────────────┐
│  Claude Vision  │ ──> Анализ: застроен/свободен, пригодность
└─────────────────┘
         │
         ↓
    Результат
```

## Установка

### 1. Требования

- Python 3.8+
- API ключ Anthropic Claude (обязательно)
- API ключ Yandex Maps (опционально, работает и без него)

### 2. Установка зависимостей

```bash
cd tools/urban-plot-analysis
pip install -r requirements.txt
```

### 3. Настройка переменных окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и укажите ваш API ключ Anthropic:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Использование

### Быстрый старт

```python
from pipeline import UrbanPlotAnalysisPipeline
import os

# Инициализация
pipeline = UrbanPlotAnalysisPipeline(
    anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
    yandex_api_key=os.getenv("YANDEX_MAPS_API_KEY"),  # опционально
    output_dir="output"
)

# Анализ одного участка по координатам
result = pipeline.analyze_single_plot(
    lat=59.9311,  # Широта
    lon=30.3609   # Долгота
)

print(result)
```

### Примеры использования

#### 1. Анализ одного участка по кадастровому номеру

```python
result = pipeline.analyze_single_plot(
    cadastral_number="78:12:1234567:890"
)
```

#### 2. Анализ участка по координатам

```python
result = pipeline.analyze_single_plot(
    lat=59.9311,
    lon=30.3609
)
```

#### 3. Поиск свободных участков в области

```python
results = pipeline.analyze_area(
    min_lat=59.90,
    min_lon=30.30,
    max_lat=59.95,
    max_lon=30.40,
    max_plots=10
)
```

#### 4. Поиск подходящих участков с фильтрацией

```python
suitable_plots = pipeline.find_suitable_plots(
    min_lat=59.90,
    min_lon=30.30,
    max_lat=59.95,
    max_lon=30.40,
    min_area=2000,  # Минимум 2000 м²
    max_plots=20
)

# Результаты отсортированы по оценке пригодности
for plot in suitable_plots[:5]:
    print(f"Кадастровый номер: {plot['plot_details']['cadastral_number']}")
    print(f"Площадь: {plot['plot_details']['area']} м²")
    print(f"Оценка пригодности: {plot['suitability_score']}/100")
    print(f"Застроен: {plot['analysis']['is_occupied']}")
    print("---")
```

### Запуск из командной строки

```bash
# Запустить пример анализа
python pipeline.py

# Или запустить тесты отдельных модулей
python rosreestr_client.py
python yandex_maps_client.py
python claude_vision_client.py
```

## Структура проекта

```
urban-plot-analysis/
├── README.md                   # Документация
├── requirements.txt            # Зависимости Python
├── .env.example               # Пример конфигурации
├── config.py                  # Настройки приложения
├── rosreestr_client.py        # Клиент Росреестра
├── yandex_maps_client.py      # Клиент Yandex Maps
├── claude_vision_client.py    # Клиент Claude Vision
├── pipeline.py                # Главный пайплайн
└── output/                    # Результаты (создается автоматически)
    ├── images/                # Спутниковые снимки
    ├── result_*.json          # Результаты анализа отдельных участков
    ├── area_report_*.json     # Отчеты по областям
    └── suitable_plots_*.json  # Отчеты по подходящим участкам
```

## Результаты анализа

### Формат результата для одного участка

```json
{
  "status": "success",
  "timestamp": "2025-10-21T15:30:00",
  "plot_details": {
    "cadastral_number": "78:12:1234567:890",
    "area": 5000,
    "area_unit": "м²",
    "category": "Земли населенных пунктов",
    "permitted_use": "Для жилищного строительства",
    "address": "Санкт-Петербург, Приморский район"
  },
  "coordinates": {
    "lat": 59.9311,
    "lon": 30.3609
  },
  "satellite_image": "output/images/plot_78_12_1234567_890.png",
  "analysis": {
    "is_occupied": false,
    "confidence": "высокий",
    "description": "Участок свободен от застройки, покрыт низкой растительностью...",
    "buildings_detected": false,
    "vegetation_level": "умеренная",
    "suitable_for_development": true,
    "recommendations": "Требуется проверка инженерных коммуникаций"
  },
  "suitability_score": 85
}
```

## API клиенты

### RosreestrClient

Работа с публичной кадастровой картой:

```python
from rosreestr_client import RosreestrClient

client = RosreestrClient()

# Поиск по координатам
plot = client.get_plot_by_coordinates(lat=59.9311, lon=30.3609)

# Поиск по кадастровому номеру
plot = client.get_plot_by_cadastral_number("78:12:1234567:890")

# Поиск в области
plots = client.search_plots_in_area(
    min_lat=59.90, min_lon=30.30,
    max_lat=59.95, max_lon=30.40
)

# Извлечь детали
details = client.get_plot_details(plot)
coords = client.get_plot_coordinates(plot)
```

### YandexMapsClient

Получение спутниковых снимков:

```python
from yandex_maps_client import YandexMapsClient

client = YandexMapsClient(api_key="your_key")  # api_key опционален

# Спутниковый снимок
image_data = client.get_satellite_image(
    lat=59.9311,
    lon=30.3609,
    zoom=18,
    width=800,
    height=600,
    save_path="plot.png"
)

# Гибридная карта (спутник + подписи)
hybrid = client.get_hybrid_image(lat=59.9311, lon=30.3609)

# С маркером
marked = client.get_map_with_marker(lat=59.9311, lon=30.3609)
```

### ClaudeVisionClient

Анализ изображений через Claude AI:

```python
from claude_vision_client import ClaudeVisionClient

client = ClaudeVisionClient(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Анализ застройки
with open("plot.png", "rb") as f:
    image_data = f.read()

result = client.analyze_plot_occupancy(
    image_data=image_data,
    plot_details={
        'cadastral_number': '78:12:1234567:890',
        'area': 5000,
        'permitted_use': 'Для жилищного строительства'
    }
)

print(result['is_occupied'])        # False
print(result['confidence'])         # "высокий"
print(result['description'])        # Описание участка
```

## Ограничения и следующие шаги

### Текущие ограничения

1. **Зонирование** - нет API доступа к генплану СПб
   - Требуется ручная проверка на portal.kgainfo.spb.ru
   - Или reverse-engineering ArcGIS endpoints

2. **Росреестр API** - неофициальное
   - Может перестать работать при изменении API
   - Рекомендуется мониторинг доступности

3. **Rate limiting** - ограничения API
   - Yandex Maps: лимиты на бесплатном плане
   - Claude: лимиты по тарифу
   - Встроены задержки между запросами

### Следующие шаги для production

1. **Зонирование**:
   - Зарегистрироваться на data.gov.spb.ru для API доступа
   - Reverse-engineer portal.kgainfo.spb.ru endpoints
   - Или парсинг PDF генплана

2. **Официальные API**:
   - Использовать официальное API Росреестра (если доступно)
   - Google Maps Static API как альтернатива Yandex

3. **Масштабирование**:
   - Кеширование результатов
   - Параллельная обработка участков
   - База данных для хранения результатов

4. **Улучшения анализа**:
   - Fine-tuning промптов для Claude
   - Дополнительные критерии фильтрации
   - Интеграция с картами коммуникаций

## Решение проблем

### Ошибка "ANTHROPIC_API_KEY not found"

Убедитесь, что создан файл `.env` с API ключом:

```bash
cp .env.example .env
# Отредактируйте .env и добавьте ключ
```

### Ошибка "Plot not found"

- Проверьте правильность координат (формат: lat, lon)
- Убедитесь, что участок существует в кадастре
- Попробуйте увеличить tolerance в запросе

### Ошибка "Failed to get satellite image"

- Проверьте доступность Yandex Maps API
- Проверьте правильность координат
- Убедитесь в наличии интернет-соединения

### Медленная работа

- Уменьшите `max_plots` в analyze_area()
- Увеличьте `REQUEST_DELAY` для снижения нагрузки на API
- Используйте меньший размер изображений

## Лицензия

Этот прототип создан для исследовательских целей.

## Поддержка

При возникновении вопросов создайте issue в репозитории проекта.
