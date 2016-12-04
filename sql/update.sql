--------------------------------------------------------------------------------
-- willie-photos - Update database structure
--------------------------------------------------------------------------------

DO $$
DECLARE
  ver varchar;
BEGIN
  EXECUTE 'SELECT value FROM core_options WHERE name = ''photos.databaseVersion''' INTO ver;

  LOOP

  	RAISE NOTICE '[Module photos] Database version is %', ver;

	--------------------------------------------------------------------------------
	-- Version 1, create the option
	--------------------------------------------------------------------------------
  	IF ver IS NULL or ver = '0.0' THEN
  		INSERT INTO core_options (name, value, builtin) VALUES ('photos.databaseVersion', '0.0', true);
  		ver = '0.1';
	ELSIF ver = '0.1' THEN
  		INSERT INTO core_options (name, value) VALUES ('photos.lastScanned', '');
  		ver = '1.0';

	--------------------------------------------------------------------------------
	-- Version 2, create fingerprints
	--------------------------------------------------------------------------------
  	ELSIF ver = '1.0' THEN
		CREATE TABLE photos_fingerprints (
		    id                  uuid primary key default uuid_generate_v4(),
		    shortFilename       varchar(1024),                                     -- file name without any path information (but with extension)
		    longFilename        varchar(4096),                                     -- fully qualitied file name (with full path)
		    mtime               timestamp with time zone,                          -- file modification time (at the time it was scanned)
		    size                bigint,                                            -- file size, in bytes
		    md5                 varchar(128),                                      -- file md5 hash
		    vanishedAt          timestamp with time zone,                          -- first time the file was not seen
		    hidden              boolean default false NOT NULL,                    -- the fingerprint is hidden
		    ownerId 		        uuid REFERENCES core_users(id) default 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'
		);  
		ver = '1.1';
  	ELSIF ver = '1.1' THEN
		CREATE UNIQUE INDEX photos_f_name ON photos_fingerprints (longFileName);
  		ver = '1.2';
  	ELSIF ver = '1.2' THEN
  		CREATE INDEX photos_f_getImages ON photos_fingerprints (ownerId, mtime DESC, longFilename, id);
  		ver = '1.3';
  	ELSIF ver = '1.3' THEN
		CREATE INDEX photos_f_md5 on photos_fingerprints (md5);
		ver = '2.0';


	--------------------------------------------------------------------------------
	-- Version 3, create images (overlays fingerprints)
	--------------------------------------------------------------------------------
  	ELSIF ver = '2.0' THEN
		CREATE TABLE photos_images (
		    id                  uuid primary key,                                  -- (0) unique identifier (matches the fingerprint key)
		    version             integer, 							                             -- (0) version of the record
		    mtime               timestamp with time zone,                          -- (0) file modification time (at the time it was scanned)
		    dateTime            timestamp with time zone,                          -- (1) timestamp of the photo (time taken)
		    width               integer,                                           -- (0) image width
		    height              integer,                                           -- (0) image height
		    resolution          varchar(32),                                       -- (1) exif resolution of the image
		    orientation         integer,                                           -- (1) exif orientation of the image
		    make                varchar(256),                                      -- (1) camera make
		    model               varchar(256),                                      -- (1) camera model
		    focalLength         real,                                              -- (1) focal length
		    exposuretime        varchar(32),                                       -- (1) exposure time
		    fnumber             varchar(32),                                       -- (1) focal ration
		    hdr                 boolean,                                           -- (1) is the image HDR (yes/no/undefined)?
		    altitude            real,                                              -- (1) altitude
		    latitude            real,                                              -- (1) latitude
		    longitude           real,                                              -- (1) longitude
		    dominantColor 	   varchar(10),						                             -- Image dominant color (ex: "#E6EDE8")
		    scanError 		      boolean DEFAULT false NOT NULL 		                 -- Add error flag on images
		);
		ver = '2.1';
  	ELSIF ver = '2.1' THEN
		CREATE UNIQUE INDEX photos_i_id ON photos_images (id);
  		ver = '3.0';

	--------------------------------------------------------------------------------
	-- Version 4, Tags (aka labels) or albums
	--------------------------------------------------------------------------------
  	ELSIF ver = '3.0' THEN
		CREATE TABLE photos_tags (
		    id                  uuid primary key default uuid_generate_v4(),
		    name                varchar(128),                                      -- name (user friendly) of the tag/album
		    coverId             uuid REFERENCES photos_fingerprints(id),           -- fingerprint of image to use as a cover
		    isDefault           boolean default FALSE,                             -- is this a default tag?
		    key                 varchar(1),                                        -- keyboard shortcut for this tag
		    color               varchar(64),                                       -- color code (ex: "#E6EDE8")
		    filter 			        varchar(4096),						                         -- dynamic albumbs are made of a SQL filter
		    ownerId 		        uuid REFERENCES core_users(id) default 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'
		);
		ver = '3.1';
  	ELSIF ver = '3.1' THEN
		CREATE UNIQUE INDEX photos_t_name ON photos_tags (name);
		ver = '4.0';

	--------------------------------------------------------------------------------
	-- Version 5, Relation between tags and fingerprints
	--------------------------------------------------------------------------------
  	ELSIF ver = '4.0' THEN
		CREATE TABLE photos_fingerprints_tags (
		    tagId               uuid REFERENCES photos_tags (id),                  -- tag (album)
		    fingerPrintId       uuid REFERENCES photos_fingerprints (id)           -- fingerprint
		);
  		ver = '4.1';
  	ELSIF ver = '4.1' THEN
		CREATE UNIQUE INDEX photos_ft_t_f ON photos_fingerprints_tags (tagId, fingerPrintId);
  		ver = '4.2';
  	ELSIF ver = '4.2' THEN
		CREATE INDEX photos_ft_getImages ON photos_fingerprints_tags (fingerPrintId);
  		ver = '5.0';

	--------------------------------------------------------------------------------
	-- Version 6
	--------------------------------------------------------------------------------
  	ELSIF ver = '5.0' THEN
		CREATE TABLE photos_images_frames (
			imageId               uuid REFERENCES photos_fingerprints(id),           --
			index                 integer,                                           --
			frameId               uuid REFERENCES photos_fingerprints(id)            --
		);
		ver = '5.1';
	ELSIF ver = '5.1' THEN
		CREATE UNIQUE INDEX photos_if_i_f ON photos_images_frames (imageId, frameId);
		ver = '6.0';



  	ELSE
  		EXIT;
  	END IF;

  END LOOP;

  UPDATE core_options SET value = ver WHERE name = 'photos.databaseVersion';

EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE '% - %', SQLSTATE, SQLERRM;
	UPDATE core_options SET value = ver WHERE name = 'photos.databaseVersion';
END $$;

