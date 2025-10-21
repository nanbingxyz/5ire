# 📥 Инструкция по скачиванию проекта

Этот проект находится внутри большого репозитория. Чтобы получить только файлы для поиска земли, следуйте инструкциям ниже.

---

## Вариант 1: Скачать через GitHub Web (самый простой)

### Шаг 1: Откройте GitHub репозиторий

Перейдите на страницу репозитория в браузере.

### Шаг 2: Перейдите в папку

Откройте папку `spb-land-finder/` в веб-интерфейсе GitHub.

### Шаг 3: Скачайте ZIP

1. Нажмите зеленую кнопку **Code**
2. Выберите **Download ZIP**
3. Распакуйте архив на вашем компьютере

---

## Вариант 2: Через Git (клонировать весь репозиторий)

### Клонировать репозиторий:

```bash
git clone https://github.com/tbikbov/konnekt.git
cd konnekt/spb-land-finder
```

### Скопировать только нужную папку:

```bash
# После клонирования
cp -r spb-land-finder/ ~/my-projects/spb-land-finder/
cd ~/my-projects/spb-land-finder/
```

---

## Вариант 3: Sparse Checkout (только нужная папка)

Если репозиторий большой и вы хотите скачать ТОЛЬКО папку `spb-land-finder`:

```bash
# Создать новую папку
mkdir spb-land-finder
cd spb-land-finder

# Инициализировать git
git init

# Добавить remote
git remote add origin https://github.com/tbikbov/konnekt.git

# Включить sparse checkout
git config core.sparseCheckout true

# Указать какую папку скачать
echo "spb-land-finder/*" >> .git/info/sparse-checkout

# Скачать
git pull origin claude/urban-plot-analysis-011CULLi2Qik8t1rkUySWAcz
```

---

## Вариант 4: Скачать отдельные файлы вручную

Если нужно скачать только несколько файлов:

1. Откройте файл на GitHub
2. Нажмите кнопку **Raw**
3. Сохраните через **Ctrl+S** (или **Cmd+S** на Mac)

### Обязательные файлы:

```
✅ requirements.txt          - Зависимости Python
✅ .env.example              - Шаблон конфигурации
✅ research_plots.py         - Исследование рынка
✅ demo.py                   - Демонстрация
✅ claude_vision_client.py   - Клиент Claude
```

### Дополнительные файлы:

```
📄 pipeline.py               - Полный пайплайн
📄 rosreestr_client.py       - Клиент Росреестра
📄 yandex_maps_client.py     - Клиент Yandex Maps
📄 example.py                - Примеры
📄 config.py                 - Конфигурация
📄 test_api_availability.py  - Тесты API
```

---

## После скачивания

### 1. Установите зависимости:

```bash
pip install -r requirements.txt
```

### 2. Настройте API ключ:

```bash
cp .env.example .env
# Отредактируйте .env и добавьте ваш ANTHROPIC_API_KEY
```

### 3. Запустите:

```bash
# Демо
python demo.py

# Исследование
python research_plots.py
```

---

## Проблемы при скачивании?

### GitHub недоступен
- Попросите владельца репозитория отправить ZIP архив
- Или попросите создать Release с архивом

### Не получается клонировать
- Проверьте доступ к репозиторию (публичный/приватный)
- Используйте HTTPS вместо SSH: `https://github.com/...`

### Ошибки с Git
- Установите Git: https://git-scm.com/downloads
- Или используйте **Вариант 1** (скачать ZIP)

---

## Структура после скачивания

```
spb-land-finder/
├── README.md                      # Основная документация
├── README_STANDALONE.md           # Этот файл
├── DOWNLOAD_INSTRUCTIONS.md       # Инструкции по скачиванию
├── QUICKSTART.md                  # Быстрый старт
├── requirements.txt               # Python зависимости
├── .env.example                   # Шаблон конфигурации
│
└── *.py                           # Python скрипты
```

---

## Готово!

После скачивания переходите к **[README_STANDALONE.md](README_STANDALONE.md)** для инструкций по использованию.

Или сразу к **[QUICKSTART.md](QUICKSTART.md)** для быстрого старта за 5 минут.
