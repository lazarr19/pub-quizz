-- Add description and emoji columns to categories for public /kategorije page
ALTER TABLE categories ADD COLUMN description TEXT;
ALTER TABLE categories ADD COLUMN emoji TEXT;

-- Update RLS to allow anonymous (unauthenticated) reads so /kategorije works publicly for SEO
DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
CREATE POLICY "Anyone can read categories" ON categories
  FOR SELECT USING (true);


UPDATE categories
SET
  emoji       = v.emoji,
  description = v.description
FROM (VALUES
  ('Vojska i ratovanje', '⚔️',  'Pitanja o oružanim snagama, bitkama, ratovima i vojnoj istoriji kroz vekove.'),
  ('Etnologija',         '🌐',  'Pitanja o narodima, kulturama, tradicijama i načinu života različitih zajednica sveta.'),
  ('Privreda',           '📈',  'Pitanja iz oblasti ekonomije, biznisa, finansija i privrednog razvoja.'),
  ('Pravo',              '⚖️',  'Pitanja o pravnom sistemu, zakonima, sudovima i pravnoj teoriji.'),
  ('Hrana i Piće',       '🍽️', 'Pitanja o kulinarstvu, receptima, gastronomiji i pićima iz celog sveta.'),
  ('Nauka',              '🔬',  'Pitanja iz fizike, hemije, biologije i ostalih prirodnih nauka.'),
  ('Psihologija',        '🧠',  'Pitanja o ljudskom umu, ponašanju, emocijama i psihološkim teorijama.'),
  ('Film',               '🎬',  'Pitanja o filmovima, rediteljima, glumcima i filmskoj industriji.'),
  ('Mitologija',         '🏛️', 'Pitanja o bogovima, herojima i legendama iz grčke, rimske, nordijske i drugih mitologija.'),
  ('Opšte znanje',       '📚',  'Raznovrsna pitanja koja pokrivaju sve oblasti i teme opšte kulture.'),
  ('Muzika',             '🎵',  'Pitanja o muzičarima, bendovima, žanrovima i istoriji muzike.'),
  ('Umetnost',           '🎨',  'Pitanja o slikarstvu, skulpturi, arhitekturi i umetnicima kroz istoriju.'),
  ('Geografija',         '🌍',  'Pitanja o državama, gradovima, rekama, planinama i geografskim pojmovima.'),
  ('Jezik i pismo',      '✍️',  'Pitanja o gramatici, jezicima sveta, pismu i lingvistici.'),
  ('Sport',              '⚽',  'Pitanja o sportistima, takmičenjima, rekordima i sportskim pravilima.'),
  ('Književnost',        '📖',  'Pitanja o knjigama, piscima, književnim delima i stilovima pisanja.'),
  ('Pop Kultura',        '🎭',  'Pitanja o trendovima, poznatim ličnostima, TV emisijama i popularnoj kulturi.'),
  ('Tehnologija',        '💻',  'Pitanja o računarima, internetu, izumima i tehnološkom napretku.'),
  ('Istorija',           '📜',  'Pitanja o istorijskim događajima, ličnostima i epohama od antike do danas.'),
  ('Priroda',            '🌿',  'Pitanja o životinjama, biljkama, ekosistemima i prirodnim pojavama.'),
  ('Zabava',             '🎉',  'Pitanja o igrama, showbiznis svetu, komediji i svemu što nas zabavlja.'),
  ('Religija',           '🕌',  'Pitanja o svetskim religijama, verovanjima, obredima i svetim tekstovima.'),
  ('Medicina',           '🩺',  'Pitanja o zdravlju, bolestima, lekovima i medicinskim dostignućima.')
) AS v(name, emoji, description)
WHERE categories.name = v.name;