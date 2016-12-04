--------------------------------------------------------------------------------
-- willie-photos - Builtin data
--------------------------------------------------------------------------------

DO $$
DECLARE
BEGIN

  -- Create builting albums
  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='7a6097fa-0486-418c-b4ed-fce2a7e8dd1f')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('7a6097fa-0486-418c-b4ed-fce2a7e8dd1f', 'Animaux',               TRUE, 'a', '#E6EDE8') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='a7432025-e603-4c8a-be66-a95131c35016')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('a7432025-e603-4c8a-be66-a95131c35016', 'Animaux > Insectes',    TRUE, 'i', '#EDE6E6') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='cdf83ef9-761c-4f58-9f95-be9813625bbe')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('cdf83ef9-761c-4f58-9f95-be9813625bbe', 'Arbres remarquables',   TRUE, 'r', '#E6EDE8') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='474ebbfd-b664-42ff-9786-0c6b7a7df426')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('474ebbfd-b664-42ff-9786-0c6b7a7df426', 'Cats',                  TRUE, 'c', '#EBEDE6') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='dedd2536-f821-435d-8171-4798b2fd3f1a')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('dedd2536-f821-435d-8171-4798b2fd3f1a', 'Cats > in prison',      TRUE, 'q', '#EBEDE6') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='547bd872-0bb1-4b40-92ea-7be4b80c93e0')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('547bd872-0bb1-4b40-92ea-7be4b80c93e0', 'Corpse Covado',         TRUE, 'k', '#E6EDE8') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='1f230f21-ac9e-4ce4-a6bf-53485c2a988c')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('1f230f21-ac9e-4ce4-a6bf-53485c2a988c', 'Design',                TRUE, 'd', '#E6EDED') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='86cffcba-88ea-4f26-9ea1-b2f39f85ee1d')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('86cffcba-88ea-4f26-9ea1-b2f39f85ee1d', 'Fleurs',                TRUE, 'f', '#E6EDED') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='00bd9905-61ae-4ae8-ba8f-1e7e9825fbb5')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('00bd9905-61ae-4ae8-ba8f-1e7e9825fbb5', 'Grems & Street art',    TRUE, 'g', '#EDEAE6') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='2cdcfd48-68f0-4b54-b561-b7bfd6472a03')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('2cdcfd48-68f0-4b54-b561-b7bfd6472a03', 'Jeux de mots laids',    TRUE, 'l', '#EDE6E9') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='e5dab557-2db7-46aa-8132-8fc33e13ae84')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('e5dab557-2db7-46aa-8132-8fc33e13ae84', 'Noé > Jardin',          TRUE, 'j', '#EDE6E9') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='f74942d8-5b32-49b6-ab40-f5f88e3408fe')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('f74942d8-5b32-49b6-ab40-f5f88e3408fe', 'Noé > Maison',          TRUE, 'm', '#EDE6E9') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='7045e642-cc42-4f11-8259-218e748cd6f4')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('7045e642-cc42-4f11-8259-218e748cd6f4', 'Noé > Travaux',         TRUE, 'v', '#EDE6E9') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='9adcba04-5cc8-4aa5-82b2-1a79297f13ee')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('9adcba04-5cc8-4aa5-82b2-1a79297f13ee', 'People',                TRUE, 'p', '#EDE6E6') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='0ba26f55-bbc6-4b1d-b04e-7d259d6f0327')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('0ba26f55-bbc6-4b1d-b04e-7d259d6f0327', 'Selfies',               TRUE, 's', '#E6EDEB') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='c8df9787-30e6-406e-9fbf-f82c2c585639')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('c8df9787-30e6-406e-9fbf-f82c2c585639', 'Ugly cities',           TRUE, 'u', '#EDE6EA') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='f3a8037f-f03e-4e9e-b231-64f032128516')
  THEN
    INSERT INTO photos_tags (id, name, isDefault, key, color) VALUES ('f3a8037f-f03e-4e9e-b231-64f032128516', 'Wallpaper',             TRUE, 'w', '#E6EAED') ON CONFLICT(id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos_tags WHERE id='3c2f995f-98c6-475e-8450-d2451082c027')
  THEN
  

  -- Animations (automatically generated gifs)
    INSERT INTO photos_tags (id, name, isDefault, filter) VALUES ('3c2f995f-98c6-475e-8450-d2451082c027', 'Animations', TRUE, 'f.longFilename LIKE ''%/thumbs/gifs/%''') ON CONFLICT(id) DO NOTHING;
  END IF;

END $$;

