-- ============================================================================
--  Старые ответы «где вы ведёте бизнес» — в коды стран.
--
--  До выбора места ведущим команды за пределами США писали страну текстом,
--  и миграция game_location сохранила его как есть в location_area. Здесь
--  знакомые названия («Россия», «Рф», «Таиланд», «Thailand», «Грузия»…)
--  становятся кодами стран: так рейтинг фильтрует их по стране и региону
--  мира. На экране они выглядят так же, а незнакомый текст остаётся текстом.
--
--  Написание перечислено целиком (россия, Россия, РОССИЯ): сравнение без
--  учёта регистра в базе зависит от её локали, а так — нет.
-- ============================================================================

with names (country, name) as (values
  ('RU', 'россия'), ('RU', 'Россия'), ('RU', 'РОССИЯ'), ('RU', 'рф'), ('RU', 'Рф'), ('RU', 'РФ'), ('RU', 'russia'), ('RU', 'Russia'), ('RU', 'RUSSIA'), ('RU', 'russian federation'), ('RU', 'Russian federation'), ('RU', 'RUSSIAN FEDERATION'), ('RU', 'Russian Federation'),
  ('BY', 'беларусь'), ('BY', 'Беларусь'), ('BY', 'БЕЛАРУСЬ'), ('BY', 'белоруссия'), ('BY', 'Белоруссия'), ('BY', 'БЕЛОРУССИЯ'), ('BY', 'belarus'), ('BY', 'Belarus'), ('BY', 'BELARUS'),
  ('KZ', 'казахстан'), ('KZ', 'Казахстан'), ('KZ', 'КАЗАХСТАН'), ('KZ', 'kazakhstan'), ('KZ', 'Kazakhstan'), ('KZ', 'KAZAKHSTAN'),
  ('UZ', 'узбекистан'), ('UZ', 'Узбекистан'), ('UZ', 'УЗБЕКИСТАН'), ('UZ', 'uzbekistan'), ('UZ', 'Uzbekistan'), ('UZ', 'UZBEKISTAN'),
  ('KG', 'киргизия'), ('KG', 'Киргизия'), ('KG', 'КИРГИЗИЯ'), ('KG', 'кыргызстан'), ('KG', 'Кыргызстан'), ('KG', 'КЫРГЫЗСТАН'), ('KG', 'kyrgyzstan'), ('KG', 'Kyrgyzstan'), ('KG', 'KYRGYZSTAN'),
  ('AM', 'армения'), ('AM', 'Армения'), ('AM', 'АРМЕНИЯ'), ('AM', 'armenia'), ('AM', 'Armenia'), ('AM', 'ARMENIA'),
  ('AZ', 'азербайджан'), ('AZ', 'Азербайджан'), ('AZ', 'АЗЕРБАЙДЖАН'), ('AZ', 'azerbaijan'), ('AZ', 'Azerbaijan'), ('AZ', 'AZERBAIJAN'),
  ('GE', 'грузия'), ('GE', 'Грузия'), ('GE', 'ГРУЗИЯ'), ('GE', 'georgia'), ('GE', 'Georgia'), ('GE', 'GEORGIA'),
  ('UA', 'украина'), ('UA', 'Украина'), ('UA', 'УКРАИНА'), ('UA', 'ukraine'), ('UA', 'Ukraine'), ('UA', 'UKRAINE'),
  ('TH', 'таиланд'), ('TH', 'Таиланд'), ('TH', 'ТАИЛАНД'), ('TH', 'тайланд'), ('TH', 'Тайланд'), ('TH', 'ТАЙЛАНД'), ('TH', 'thailand'), ('TH', 'Thailand'), ('TH', 'THAILAND'),
  ('SG', 'сингапур'), ('SG', 'Сингапур'), ('SG', 'СИНГАПУР'), ('SG', 'singapore'), ('SG', 'Singapore'), ('SG', 'SINGAPORE'),
  ('ID', 'индонезия'), ('ID', 'Индонезия'), ('ID', 'ИНДОНЕЗИЯ'), ('ID', 'indonesia'), ('ID', 'Indonesia'), ('ID', 'INDONESIA'),
  ('VN', 'вьетнам'), ('VN', 'Вьетнам'), ('VN', 'ВЬЕТНАМ'), ('VN', 'vietnam'), ('VN', 'Vietnam'), ('VN', 'VIETNAM'),
  ('AE', 'оаэ'), ('AE', 'Оаэ'), ('AE', 'ОАЭ'), ('AE', 'uae'), ('AE', 'Uae'), ('AE', 'UAE'), ('AE', 'united arab emirates'), ('AE', 'United arab emirates'), ('AE', 'UNITED ARAB EMIRATES'), ('AE', 'United Arab Emirates'),
  ('TR', 'турция'), ('TR', 'Турция'), ('TR', 'ТУРЦИЯ'), ('TR', 'turkey'), ('TR', 'Turkey'), ('TR', 'TURKEY'), ('TR', 'türkiye'), ('TR', 'Türkiye'), ('TR', 'TÜRKIYE'),
  ('CY', 'кипр'), ('CY', 'Кипр'), ('CY', 'КИПР'), ('CY', 'cyprus'), ('CY', 'Cyprus'), ('CY', 'CYPRUS'),
  ('RS', 'сербия'), ('RS', 'Сербия'), ('RS', 'СЕРБИЯ'), ('RS', 'serbia'), ('RS', 'Serbia'), ('RS', 'SERBIA'),
  ('DE', 'германия'), ('DE', 'Германия'), ('DE', 'ГЕРМАНИЯ'), ('DE', 'germany'), ('DE', 'Germany'), ('DE', 'GERMANY'),
  ('GB', 'великобритания'), ('GB', 'Великобритания'), ('GB', 'ВЕЛИКОБРИТАНИЯ'), ('GB', 'united kingdom'), ('GB', 'United kingdom'), ('GB', 'UNITED KINGDOM'), ('GB', 'United Kingdom'), ('GB', 'uk'), ('GB', 'Uk'), ('GB', 'UK'), ('GB', 'england'), ('GB', 'England'), ('GB', 'ENGLAND'),
  ('US', 'сша'), ('US', 'Сша'), ('US', 'США'), ('US', 'usa'), ('US', 'Usa'), ('US', 'USA'), ('US', 'united states'), ('US', 'United states'), ('US', 'UNITED STATES'), ('US', 'United States'),
  ('CA', 'канада'), ('CA', 'Канада'), ('CA', 'КАНАДА'), ('CA', 'canada'), ('CA', 'Canada'), ('CA', 'CANADA'),
  ('MX', 'мексика'), ('MX', 'Мексика'), ('MX', 'МЕКСИКА'), ('MX', 'mexico'), ('MX', 'Mexico'), ('MX', 'MEXICO'), ('MX', 'méxico'), ('MX', 'México'), ('MX', 'MÉXICO'),
  ('BR', 'бразилия'), ('BR', 'Бразилия'), ('BR', 'БРАЗИЛИЯ'), ('BR', 'brazil'), ('BR', 'Brazil'), ('BR', 'BRAZIL'), ('BR', 'brasil'), ('BR', 'Brasil'), ('BR', 'BRASIL'),
  ('AR', 'аргентина'), ('AR', 'Аргентина'), ('AR', 'АРГЕНТИНА'), ('AR', 'argentina'), ('AR', 'Argentina'), ('AR', 'ARGENTINA')
)
update players p
   set location_country = n.country, location_area = null
  from names n
 where p.location_country is null
   and btrim(p.location_area) = n.name;
