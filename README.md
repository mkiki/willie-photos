# Willie photos module

The Photos module is a Photo Organizer. It synchronisez local folders with a database, and compute image metadata and organisez photos.

### Flavors
Image thumbnails are generated in several different flavors.

* Thumbnails are square miniatures of the images, typically zomming on the center of the image. The corresponding flavor is the thumbnail size, in pixels. For instance "128"
* Scaled images are miniatures resized to fit into a canvas, conserving aspect-ratio. Therefore the resulting image size may be smaller than the actual canvas. The corresponding flavor is the canvas size, such as "1024x768"
* Exact dimension images are non-square thumbnails fitting into a rectangular canvas, conserving aspect ratio. But the image is cropped horizontally or vertically to fully fill the canvas. The corresponding flavor is the canvas size preceded by an equals sign, such as "=386x258"

## Installation

	npm link wg-log
	npm link wg-utils
	npm link wg-database
	npm link wg-exif
	npm link wg-scanner
	npm link wg-thumbs
	npm link willie-core
	npm install


## Database

The core module provides the following database entities

* Fingerprints (```photos_fingerprints```) represent fingerprint of files
* Images (```photos_images```) 
* Tag (```photos_tags```) represent tags or albums


## Commands

* ```scan``` - Scan local folders or files
* ```cleanup``` - Database hygiene
* ```exif``` - Extract exif information from files


## APIs

### Get images metadata

	type: 'GET'
	url: '/photos/images'
	data: { }
	dataType: 'json'

Query parameters

* ```offset``` - For pagination, the starting index
* ```limit``` - For pagination, the max number of items to retreive
* ```tag``` - If present, represents the UUID of a tag (album) to filter on
* ```byYear``` - If present, represents the year (ex: 2014) to filter on
* ```hidden``` - If present and true, will also return hidden images

### Get image metadata

	type: 'GET'
	url: '/photos/image/:uuid'
	data: { }
	dataType: 'json'

### Get image thumb

	type: 'GET'
	url: '/photos/thumb/:flavor/:uuid'
	data: { }
	dataType: 'json'

### Modify the metadata for a set of images
Typically applies to a selection

	type: 'PATCH'
	url: '/photos/images'
	data: { }
	dataType: 'json'

### Get albums metadata

	type: 'GET'
	url: '/photos/albums/:order'
	data: { }
	dataType: 'json'

The ```order``` parameter indicats the order in which to return albums. It can be ```byDateDesc``` or ```byName```.

### Get album metadata

	type: 'GET'
	url: '/photos/album/:uuid'
	data: { }
	dataType: 'json'

### Create an album

	type: 'POST'
	url: '/photos/album'
	data: { }
	dataType: 'json'

### Delete an album

	type: 'DELETE'
	url: '/photos/album/:uuid'
	data: { }
	dataType: 'json'

### Modify an album

	type: 'PATCH'
	url: '/photos/album/:uuid'
	data: { }
	dataType: 'json'


### Get the default (OOB tags)

	type: 'GET'
	url: '/photos/defaultTags'
	data: { }
	dataType: 'json'

## Pages

### Photos browser

	url: '/photos/photos.html'

### Albums browser

	url: '/photos/albums.html'

### Photo navigator

	utl: '/photos/navigator.html'


## Changelog

1.3.0 - Cleanup, push to github
