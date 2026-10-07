Globe textures. Both are equirectangular, 4096 x 2048 (longitude -180 to 180 left to right, latitude 90 to -90
top to bottom), and both come from the example assets of three-globe (https://github.com/vasturiano/three-globe,
example/img/, MIT-licensed repository).

earth-day.jpg    three-globe example/img/earth-blue-marble.jpg. NASA Blue Marble imagery (NASA Visible Earth),
                 public domain.
earth-night.jpg  three-globe example/img/earth-night.jpg. NASA city lights imagery (NASA Visible Earth), public domain.

three-globe does not print the exact NASA source records for these files, so the NASA attribution above is the
usual one for these images and was not independently traced to a specific Visible Earth record.

The ocean glint is computed in the Earth shader from the day image (blue-dominant pixels), not from a separate mask.
The star background is generated in code and is decorative only (not a star catalogue).
