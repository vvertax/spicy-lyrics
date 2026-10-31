# Spicy Lyrics — vvertax Edition

[English](./README.md) · **Русский**

Неофициальное расширение Spicetify для настольного Spotify на основе Spicy Lyrics и его форков.

## Возможности

- Русский и английский интерфейс с сохранением выбранного языка.

- Пословная синхронизация, несколько источников текстов и настройка анимаций.
- Настройки в стиле Ruytha, пользовательские шрифты и скрытие параметров.
- Караоке, режим записи и горячие клавиши.
- Настраиваемые быстрые кнопки: действия на странице или внутри меню.
- Карточки цитат с цветами обложки, сохранением PNG и копированием изображения.
- Поиск работ авторов, замечания к строкам и сравнение TTML A/B.
- Автообновления через канал **vvertax Edition**.

## Установка

Нужны настольный Spotify и [Spicetify](https://spicetify.app).
Перед установкой отключите другие расширения Spicy Lyrics.

1. Скачайте [spicy-lyrics-sl.mjs](https://lrc.vvrtx.lol/spicy-lyrics-sl.mjs).
2. Положите файл в папку **Extensions** вашего Spicetify. Команда `spicetify -c` покажет путь к конфигурации; папка находится рядом с ней.
3. Выполните:

```powershell
spicetify config extensions spicy-lyrics-sl.mjs
spicetify apply
```

При первом запуске загрузчик выбирает **vvertax Edition** и получает обновления при запуске Spotify.

## Сборка из исходников

Нужны Node.js 24 и npm.

```sh
npm ci
npm test
npm run build
```

Результат: `dist/spicy-lyrics@<версия>.mjs`. Установите этот файл вместо загрузчика, если нужна фиксированная локальная сборка.

## Авторы исходных проектов

Основано на работах [Spikerko](https://github.com/Spikerko/spicy-lyrics), [iPixelGalaxy](https://github.com/iPixelGalaxy/spicy-lyrics) и [Ruytha](https://github.com/Ruytha/spicy-lyrics-ruytha-edition).

[AGPL v3](LICENSE) · [Авторство](NOTICE.md) · [История изменений](CHANGELOG.md)
