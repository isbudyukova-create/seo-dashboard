# Памятка по функциям metrika_updater.gs

## Метрика (metrika_updater.gs)

### Все листы бренда

| Функция | Что делает |
|---|---|
| `metrikaStomatologyNew` | Стоматология — только новые месяцы (все листы) |
| `metrikaStomatologyFull` | Стоматология — полная перезапись с 2025-01-01 (все листы) |
| `metrikaZdorovenokNew` | Здоровенок — только новые месяцы |
| `metrikaZdorovenokFull` | Здоровенок — полная перезапись |
| `metrikaKosmetologiyaNew` | Косметология — только новые месяцы |
| `metrikaKosmetologiyaFull` | Косметология — полная перезапись |
| `metrikaKdlNew` | КДЛ — только новые месяцы |
| `metrikaKdlFull` | КДЛ — полная перезапись |
| `metrikaDinoNew` | Дино — только новые месяцы |
| `metrikaDinoFull` | Дино — полная перезапись |
| `runMonthlyUpdate` | Все бренды — только новые месяцы (запускается триггером) |
| `createMonthlyTrigger` | Создать/пересоздать триггер (2-е число каждого месяца, 9:00) |

### Только лист metrika_sources (источники трафика + детализация)

| Функция | Что делает |
|---|---|
| `metrikaStomatologySourcesNew` | Стоматология — дописать новые месяцы в sources |
| `metrikaStomatologySourcesFull` | Стоматология — перезаписать только sources |
| `metrikaZdorovenokSourcesNew` | Здоровенок — дописать новые месяцы |
| `metrikaZdorovenokSourcesFull` | Здоровенок — перезаписать только sources |
| `metrikaKosmetologiyaSourcesNew` | Косметология — дописать новые месяцы |
| `metrikaKosmetologiyaSourcesFull` | Косметология — перезаписать только sources |
| `metrikaKdlSourcesNew` | КДЛ — дописать новые месяцы |
| `metrikaKdlSourcesFull` | КДЛ — перезаписать только sources |
| `metrikaDinoSourcesNew` | Дино — дописать новые месяцы |
| `metrikaDinoSourcesFull` | Дино — перезаписать только sources |
| `runAllSourcesFull` | Все бренды — перезаписать только sources |

## Директ (direct_updater.gs)

| Функция | Что делает |
|---|---|
| `directStomatologyNew` | Стоматология — только новые недели |
| `directStomatologyFull` | Стоматология — полная перезапись |
| `runWeeklyUpdate` | Все бренды — только новые недели (запускается триггером) |
| `createWeeklyTrigger` | Создать/пересоздать триггер (каждый понедельник в 8:00) |

## Когда что использовать

**New** — штатный запуск, докидывает только те месяцы, которых ещё нет в таблице. Запускай вручную если триггер не сработал.

**Full (все листы)** — если данные испорчены или нужно пересчитать всё с нуля. Удалит все листы бренда и запишет заново с 2025-01-01.

**SourcesFull / runAllSourcesFull** — для разовой миграции: перезаписывает только лист `metrika_sources`, добавляет колонку `parent` и строки с детализацией по соцсетям, мессенджерам и рекомендательным системам. Остальные листы (traffic, adv, pages) не трогает.

**createMonthlyTrigger** — запустить один раз при первоначальной настройке или если триггер пропал из Apps Script.
