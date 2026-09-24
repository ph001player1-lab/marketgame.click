-- ============================================================================
--  Логотип спонсора файлом.
--
--  Ведущий может не только дать ссылку на картинку, но и загрузить файл
--  логотипа прямо в пульте: браузер обрезает прозрачные поля, уменьшает
--  картинку и присылает её как data:image/png;base64,… Хранится она в
--  отдельной таблице, чтобы select * from games не таскал десятки килобайт
--  в каждом запросе. Функция отдаёт логотип по GET ?logo=<id игры> с
--  долгим кешем; номер версии в ссылке (games.sponsor_logo_rev) сбрасывает
--  кеш при замене логотипа. 0 — загруженного логотипа нет.
-- ============================================================================

alter table games add column sponsor_logo_rev int not null default 0;

create table game_logos (
  game_id     uuid primary key references games(id) on delete cascade,
  data        text not null check (length(data) <= 700000),
  updated_at  timestamptz not null default now()
);

alter table game_logos enable row level security;
