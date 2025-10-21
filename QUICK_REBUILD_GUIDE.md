# 🚀 Быстрое воссоздание проекта "Поиск земли в СПб"

Эта инструкция позволит вам воссоздать проект с нуля за 10 минут.

---

## 📁 Шаг 1: Создайте структуру

```bash
mkdir spb-land-finder
cd spb-land-finder
```

---

## 📄 Шаг 2: Создайте файлы

Скопируйте содержимое каждого файла ниже:

### 2.1 requirements.txt

Создайте файл `requirements.txt`:

```
requests>=2.31.0
anthropic>=0.40.0
pandas>=2.0.0
geopy>=2.4.0
Pillow>=10.0.0
python-dotenv>=1.0.0
loguru>=0.7.0
typing-extensions>=4.8.0
```

### 2.2 .env.example

Создайте файл `.env.example`:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
YANDEX_MAPS_API_KEY=your_yandex_maps_api_key_here
OUTPUT_DIR=output
LOG_LEVEL=INFO
MIN_PLOT_AREA=1000
MAX_PLOTS_TO_ANALYZE=20
SATELLITE_ZOOM_LEVEL=18
IMAGE_WIDTH=800
IMAGE_HEIGHT=600
REQUEST_DELAY=2
```

### 2.3 .gitignore

Создайте файл `.gitignore`:

```
.env
output/
*.log
__pycache__/
*.pyc
.venv/
venv/
```

---

## 📄 Шаг 3: Основные Python файлы

### 3.1 config.py

**Весь код в PROJECT_SPECIFICATION.md, файл 4**

Ключевые моменты:
- Загрузка переменных из .env
- Валидация ANTHROPIC_API_KEY
- Границы районов СПб
- Настройки по умолчанию

### 3.2 research_plots.py (ГЛАВНЫЙ ФАЙЛ)

**Весь код в PROJECT_SPECIFICATION.md, файл 8**

Это главный скрипт для исследования рынка. Запустите его:

```bash
python research_plots.py
```

Получите:
- Детальный отчет с источниками
- JSON и Markdown файлы
- Конкретные районы и цены

---

## 📄 Шаг 4: API клиенты (опционально)

Если нужен полный функционал (не только исследование):

### 4.1 rosreestr_client.py
**Код в PROJECT_SPECIFICATION.md, файл 5**

### 4.2 yandex_maps_client.py
**Код в PROJECT_SPECIFICATION.md, файл 6**

### 4.3 claude_vision_client.py
**Код в PROJECT_SPECIFICATION.md, файл 7**

---

## ⚡ Шаг 5: Запуск

### 5.1 Установите зависимости:

```bash
pip install -r requirements.txt
```

### 5.2 Настройте API ключ:

```bash
cp .env.example .env
nano .env  # Добавьте ваш ANTHROPIC_API_KEY
```

### 5.3 Запустите исследование:

```bash
python research_plots.py
```

---

## 📊 Что получите

После запуска `research_plots.py`:

```
output/
├── research_report_*.json   # JSON данные
└── research_report_*.md     # Читаемый отчет
```

**Содержимое отчета:**
- ✅ 5 приоритетных районов СПб
- ✅ Конкретные локации и площади
- ✅ 20+ официальных источников (URL)
- ✅ Критерии подбора участков
- ✅ Процесс получения земли (пошагово)
- ✅ Цены: 5,000-150,000 руб/м²
- ✅ Сроки: 3-9 месяцев
- ✅ Контакты организаций

---

## 🎯 Минимальная версия (только исследование)

Если нужно **ТОЛЬКО** исследование рынка (без анализа изображений):

**Необходимые файлы:**
1. `requirements.txt` (только anthropic, loguru, python-dotenv)
2. `.env` с ANTHROPIC_API_KEY
3. `research_plots.py`

**Запуск:**
```bash
pip install anthropic loguru python-dotenv
python research_plots.py
```

Это даст вам полный отчет по рынку земли в СПб!

---

## 📦 Альтернатива: Скачать архив

Если проект запушен в репо, скачайте:

```bash
# Из корня репо
tar -xzf spb-land-finder.tar.gz
cd spb-land-finder
pip install -r requirements.txt
cp .env.example .env
# Добавьте API ключ в .env
python research_plots.py
```

---

## 🔗 Полная документация

Откройте **PROJECT_SPECIFICATION.md** для:
- Полных листингов всех файлов
- Детального описания архитектуры
- Примеров использования API клиентов
- Расширенных возможностей

---

## 💡 Быстрые команды

```bash
# Создать проект
mkdir spb-land-finder && cd spb-land-finder

# Создать requirements.txt
cat > requirements.txt << EOF
anthropic>=0.40.0
loguru>=0.7.0
python-dotenv>=1.0.0
EOF

# Установить
pip install -r requirements.txt

# Создать .env
echo "ANTHROPIC_API_KEY=ваш-ключ" > .env

# Скопировать research_plots.py из PROJECT_SPECIFICATION.md

# Запустить
python research_plots.py
```

---

## ✅ Готово!

Теперь у вас есть рабочий инструмент для поиска земли в Санкт-Петербурге!

Для расширения функционала (анализ изображений, пайплайн) добавьте остальные файлы из PROJECT_SPECIFICATION.md.
