/* ===================================================================
   AMA can (aerosol only), for the Gas Blend Scrap Factor Report.
   Built Nov 2, 2026 from the AMA characters source (Oct 15, 2026), keeping
   only the Aerosol character: our 211 x 413 can. No 413 drawing exists yet,
   so it is the can spotlight's 211 x 713 lathe profile with the wall
   shortened to the 413's height (142.0 mm overall), with the white TE 510
   swirl cap from Don's file. Drawn at 0.643 px per mm on desktop and 0.466
   on phones. Designed by Don Sang Chin.

   First visit: the 3D can drops in and turns to face front, its outline
   draws on in ink, the fills come in, the 3D fades and the face draws on;
   then it says hello. After that it pops straight up. Without WebGL, on
   software WebGL or if three.js is slow, the outline still draws on. With
   reduced motion it is simply there, still.

   API: AF.ama.mount(opts) -> { open, close, search, replay, seek, reindex, destroy }
     opts.link(entry, key) href for a result (default '#' + entry.h)
     opts.target           link target (default '_self')
     opts.onJump(entry,e)  called when a result is opened
     opts.indexSrc         { aerosol: file } loaded on first open, unless
                           AF.amaIndexes.aerosol is already set (an index or a promise of one)
     opts.src3d, opts.threeSrc   the 3D intro file and three.js r128
   The site sets its own wording on AF.ama.CHARS.aerosol before mounting
   (eyebrow, label, greet, placeholder, chips, hint, coverage, refGroup).
   =================================================================== */
(function () {
  const AF = window.AF = window.AF || {};
  const GEO = {"can":{"body_fill":"M-15.7 -0.5C-20.9 -0.4 -15.6 0.1 -15.6 0.5C-15.6 0.8 -15.5 1.2 -15.6 1.5C-15.7 1.8 -16.0 1.9 -16.1 2.2C-16.3 2.4 -16.5 2.6 -16.7 2.8C-16.8 3.1 -17.0 3.3 -17.2 3.5C-17.4 3.7 -17.6 3.9 -17.7 4.2C-17.9 4.4 -18.1 4.6 -18.3 4.8C-18.4 5.1 -18.6 5.3 -18.8 5.5C-19.0 5.7 -19.2 5.9 -19.3 6.2C-19.5 6.4 -19.7 6.6 -19.9 6.8C-20.0 7.1 -20.2 7.3 -20.4 7.5C-20.6 7.7 -20.9 8.0 -21.1 8.2C-21.4 8.5 -21.7 8.8 -21.9 9.0C-22.1 9.2 -22.2 9.4 -22.4 9.7C-22.6 9.9 -22.7 10.1 -22.9 10.3C-23.1 10.6 -23.2 10.8 -23.4 11.0C-23.6 11.2 -23.7 11.4 -23.9 11.7C-24.0 11.9 -24.2 12.1 -24.3 12.3C-24.5 12.6 -24.6 12.7 -24.8 13.0C-25.0 13.3 -25.2 13.7 -25.5 14.0C-25.7 14.3 -25.9 14.7 -26.1 15.0C-26.3 15.3 -26.4 15.6 -26.5 15.8C-26.7 16.1 -26.8 16.4 -27.0 16.7C-27.1 16.9 -27.3 17.2 -27.4 17.5C-27.6 17.8 -27.8 18.2 -28.0 18.5C-28.2 18.8 -28.3 19.2 -28.5 19.5C-28.7 19.8 -28.8 20.2 -29.0 20.5C-29.2 20.8 -29.3 21.2 -29.5 21.5C-29.7 21.8 -29.8 22.2 -29.9 22.5C-30.1 22.8 -30.3 23.2 -30.4 23.5C-30.5 23.8 -30.5 24.2 -30.6 24.5C-30.7 24.8 -30.8 25.2 -30.9 25.5C-31.0 25.8 -31.0 26.2 -31.1 26.5C-31.2 26.8 -31.4 27.2 -31.5 27.5C-31.6 27.8 -31.7 28.2 -31.8 28.5C-31.9 28.8 -32.0 29.2 -32.1 29.5C-32.1 29.8 -32.3 30.2 -32.3 30.5C-32.4 30.8 -32.4 31.2 -32.5 31.5C-32.5 31.8 -32.6 32.2 -32.6 32.5C-32.6 32.8 -32.7 33.2 -32.7 33.5C-32.8 33.8 -32.8 34.2 -32.9 34.5C-32.9 34.8 -33.0 35.2 -33.0 35.5C-33.1 35.8 -33.1 36.2 -33.1 36.5C-33.1 36.8 -33.1 37.2 -33.2 37.5C-33.2 37.8 -33.2 38.2 -33.2 38.5C-33.2 38.8 -33.2 39.1 -33.2 39.3C-33.2 39.6 -33.2 39.9 -33.2 40.2C-33.3 40.4 -33.3 40.7 -33.3 41.0C-33.3 41.3 -33.3 41.8 -33.3 42.2C-33.3 42.6 -33.3 43.0 -33.3 43.4C-33.3 43.8 -33.3 44.2 -33.3 44.6C-33.3 45.0 -33.3 45.4 -33.3 45.8C-33.3 46.2 -33.3 46.6 -33.3 47.0C-33.3 47.4 -33.3 47.8 -33.3 48.1C-33.3 48.5 -33.3 48.9 -33.3 49.3C-33.3 49.7 -33.3 50.1 -33.3 50.5C-33.3 50.9 -33.3 51.3 -33.3 51.7C-33.3 52.1 -33.3 52.5 -33.3 52.9C-33.3 53.3 -33.3 53.7 -33.3 54.1C-33.3 54.5 -33.3 54.9 -33.3 55.3C-33.3 55.7 -33.3 56.1 -33.3 56.5C-33.3 56.9 -33.3 57.3 -33.3 57.7C-33.3 58.1 -33.3 58.5 -33.3 58.9C-33.3 59.3 -33.3 59.7 -33.3 60.1C-33.3 60.5 -33.3 60.9 -33.3 61.3C-33.3 61.7 -33.3 62.0 -33.3 62.4C-33.3 62.8 -33.3 63.2 -33.3 63.6C-33.3 64.0 -33.3 64.4 -33.3 64.8C-33.3 65.2 -33.3 65.6 -33.3 66.0C-33.3 66.4 -33.3 66.8 -33.3 67.2C-33.3 67.6 -33.3 68.0 -33.3 68.4C-33.3 68.8 -33.3 69.2 -33.3 69.6C-33.3 70.0 -33.3 70.4 -33.3 70.8C-33.3 71.2 -33.3 71.6 -33.3 72.0C-33.3 72.4 -33.3 72.8 -33.3 73.2C-33.3 73.6 -33.3 74.0 -33.3 74.4C-33.3 74.8 -33.3 75.2 -33.3 75.6C-33.3 75.9 -33.3 76.3 -33.3 76.7C-33.3 77.1 -33.3 77.5 -33.3 77.9C-33.3 78.3 -33.3 78.7 -33.3 79.1C-33.3 79.5 -33.3 79.9 -33.3 80.3C-33.3 80.7 -33.3 81.1 -33.3 81.5C-33.3 81.9 -33.3 82.3 -33.3 82.7C-33.3 83.1 -33.3 83.5 -33.3 83.9C-33.3 84.3 -33.3 84.7 -33.3 85.1C-33.3 85.5 -33.3 85.9 -33.3 86.3C-33.3 86.7 -33.3 87.1 -33.3 87.5C-33.3 87.9 -33.3 88.3 -33.3 88.7C-33.3 89.1 -33.3 89.5 -33.3 89.8C-33.3 90.2 -33.3 90.6 -33.3 91.0C-33.3 91.4 -33.3 91.8 -33.3 92.2C-33.3 92.6 -33.3 93.0 -33.3 93.4C-33.3 93.8 -33.3 94.2 -33.3 94.6C-33.3 95.0 -33.3 95.4 -33.3 95.8C-33.3 96.2 -33.3 96.6 -33.3 97.0C-33.3 97.4 -33.3 97.8 -33.3 98.2C-33.3 98.6 -33.3 99.0 -33.3 99.4C-33.3 99.8 -33.3 100.2 -33.3 100.6C-33.3 101.0 -33.3 101.4 -33.3 101.8C-33.3 102.2 -33.3 102.6 -33.3 103.0C-33.3 103.4 -33.3 103.7 -33.3 104.1C-33.3 104.5 -33.3 104.9 -33.3 105.3C-33.3 105.7 -33.3 106.1 -33.3 106.5C-33.3 106.9 -33.3 107.3 -33.3 107.7C-33.3 108.1 -33.3 108.5 -33.3 108.9C-33.3 109.3 -33.3 109.7 -33.3 110.1C-33.3 110.5 -33.3 110.9 -33.3 111.3C-33.3 111.7 -33.3 112.1 -33.3 112.5C-33.3 112.9 -33.3 113.3 -33.3 113.7C-33.3 114.1 -33.3 114.5 -33.3 114.9C-33.3 115.3 -33.3 115.7 -33.3 116.1C-33.3 116.5 -33.3 116.9 -33.3 117.3C-33.3 117.6 -33.3 118.0 -33.3 118.4C-33.3 118.8 -33.3 119.2 -33.3 119.6C-33.3 120.0 -33.3 120.4 -33.3 120.8C-33.3 121.2 -33.3 121.6 -33.3 122.0C-33.3 122.4 -33.3 122.8 -33.3 123.2C-33.3 123.6 -33.3 124.0 -33.3 124.4C-33.3 124.8 -33.3 125.2 -33.3 125.6C-33.3 126.0 -33.3 126.4 -33.3 126.8C-33.3 127.2 -33.3 127.6 -33.3 128.0C-33.3 128.4 -33.3 128.8 -33.3 129.2C-33.3 129.6 -33.3 130.0 -33.3 130.4C-33.3 130.8 -33.3 131.2 -33.3 131.5C-33.3 131.9 -33.3 132.4 -33.3 132.7C-33.2 133.0 -33.0 133.2 -32.9 133.4C-32.8 133.6 -32.8 133.8 -32.6 134.0C-32.4 134.3 -31.8 134.6 -31.8 134.8C-31.7 135.0 -32.1 135.1 -32.3 135.2C-32.5 135.4 -32.7 135.4 -32.8 135.6C-32.9 135.9 -32.8 136.2 -32.8 136.5C-32.8 136.8 -32.9 137.2 -32.8 137.4C-32.8 137.7 -32.7 138.0 -32.5 138.1C-32.3 138.3 -31.8 138.4 -31.4 138.4C-31.0 138.5 -30.6 138.4 -30.2 138.4C-29.8 138.4 -29.4 138.4 -29.0 138.4C-28.6 138.4 -28.2 138.4 -27.8 138.4C-27.5 138.4 -27.1 138.4 -26.7 138.4C-26.3 138.4 -25.9 138.4 -25.5 138.4C-25.1 138.4 -24.7 138.4 -24.3 138.4C-23.9 138.4 -23.5 138.4 -23.1 138.4C-22.7 138.4 -22.3 138.4 -21.9 138.4C-21.5 138.4 -21.1 138.4 -20.7 138.4C-20.3 138.4 -19.9 138.4 -19.6 138.4C-19.2 138.4 -18.8 138.4 -18.4 138.4C-18.0 138.4 -17.6 138.4 -17.2 138.4C-16.8 138.4 -16.4 138.4 -16.0 138.4C-15.6 138.4 -15.2 138.4 -14.8 138.4C-14.4 138.4 -14.0 138.4 -13.6 138.4C-13.2 138.4 -12.8 138.4 -12.4 138.4C-12.0 138.4 -11.7 138.4 -11.3 138.4C-10.9 138.4 -10.5 138.4 -10.1 138.4C-9.7 138.4 -9.3 138.4 -8.9 138.4C-8.5 138.4 -8.1 138.4 -7.7 138.4C-7.3 138.4 -6.9 138.4 -6.5 138.4C-6.1 138.4 -5.7 138.4 -5.3 138.4C-4.9 138.4 -4.5 138.4 -4.1 138.4C-3.8 138.4 -3.4 138.4 -3.0 138.4C-2.6 138.4 -2.2 138.4 -1.8 138.4C-1.4 138.4 -1.0 138.4 -0.6 138.4C-0.2 138.4 0.2 138.4 0.6 138.4C1.0 138.4 1.4 138.4 1.8 138.4C2.2 138.4 2.6 138.4 3.0 138.4C3.4 138.4 3.8 138.4 4.1 138.4C4.5 138.4 4.9 138.4 5.3 138.4C5.7 138.4 6.1 138.4 6.5 138.4C6.9 138.4 7.3 138.4 7.7 138.4C8.1 138.4 8.5 138.4 8.9 138.4C9.3 138.4 9.7 138.4 10.1 138.4C10.5 138.4 10.9 138.4 11.3 138.4C11.7 138.4 12.0 138.4 12.4 138.4C12.8 138.4 13.2 138.4 13.6 138.4C14.0 138.4 14.4 138.4 14.8 138.4C15.2 138.4 15.6 138.4 16.0 138.4C16.4 138.4 16.8 138.4 17.2 138.4C17.6 138.4 18.0 138.4 18.4 138.4C18.8 138.4 19.2 138.4 19.6 138.4C19.9 138.4 20.3 138.4 20.7 138.4C21.1 138.4 21.5 138.4 21.9 138.4C22.3 138.4 22.7 138.4 23.1 138.4C23.5 138.4 23.9 138.4 24.3 138.4C24.7 138.4 25.1 138.4 25.5 138.4C25.9 138.4 26.3 138.4 26.7 138.4C27.1 138.4 27.5 138.4 27.8 138.4C28.2 138.4 28.6 138.4 29.0 138.4C29.4 138.4 29.8 138.4 30.2 138.4C30.6 138.4 31.0 138.5 31.4 138.4C31.8 138.4 32.3 138.3 32.5 138.1C32.7 138.0 32.8 137.7 32.8 137.4C32.9 137.2 32.8 136.8 32.8 136.5C32.8 136.2 32.9 135.9 32.8 135.6C32.7 135.4 32.5 135.4 32.3 135.2C32.1 135.1 31.7 135.0 31.8 134.8C31.8 134.6 32.4 134.3 32.6 134.0C32.8 133.8 32.8 133.6 32.9 133.4C33.0 133.2 33.2 133.0 33.3 132.7C33.3 132.4 33.3 131.9 33.3 131.5C33.3 131.2 33.3 130.8 33.3 130.4C33.3 130.0 33.3 129.6 33.3 129.2C33.3 128.8 33.3 128.4 33.3 128.0C33.3 127.6 33.3 127.2 33.3 126.8C33.3 126.4 33.3 126.0 33.3 125.6C33.3 125.2 33.3 124.8 33.3 124.4C33.3 124.0 33.3 123.6 33.3 123.2C33.3 122.8 33.3 122.4 33.3 122.0C33.3 121.6 33.3 121.2 33.3 120.8C33.3 120.4 33.3 120.0 33.3 119.6C33.3 119.2 33.3 118.8 33.3 118.4C33.3 118.0 33.3 117.6 33.3 117.3C33.3 116.9 33.3 116.5 33.3 116.1C33.3 115.7 33.3 115.3 33.3 114.9C33.3 114.5 33.3 114.1 33.3 113.7C33.3 113.3 33.3 112.9 33.3 112.5C33.3 112.1 33.3 111.7 33.3 111.3C33.3 110.9 33.3 110.5 33.3 110.1C33.3 109.7 33.3 109.3 33.3 108.9C33.3 108.5 33.3 108.1 33.3 107.7C33.3 107.3 33.3 106.9 33.3 106.5C33.3 106.1 33.3 105.7 33.3 105.3C33.3 104.9 33.3 104.5 33.3 104.1C33.3 103.7 33.3 103.4 33.3 103.0C33.3 102.6 33.3 102.2 33.3 101.8C33.3 101.4 33.3 101.0 33.3 100.6C33.3 100.2 33.3 99.8 33.3 99.4C33.3 99.0 33.3 98.6 33.3 98.2C33.3 97.8 33.3 97.4 33.3 97.0C33.3 96.6 33.3 96.2 33.3 95.8C33.3 95.4 33.3 95.0 33.3 94.6C33.3 94.2 33.3 93.8 33.3 93.4C33.3 93.0 33.3 92.6 33.3 92.2C33.3 91.8 33.3 91.4 33.3 91.0C33.3 90.6 33.3 90.2 33.3 89.8C33.3 89.5 33.3 89.1 33.3 88.7C33.3 88.3 33.3 87.9 33.3 87.5C33.3 87.1 33.3 86.7 33.3 86.3C33.3 85.9 33.3 85.5 33.3 85.1C33.3 84.7 33.3 84.3 33.3 83.9C33.3 83.5 33.3 83.1 33.3 82.7C33.3 82.3 33.3 81.9 33.3 81.5C33.3 81.1 33.3 80.7 33.3 80.3C33.3 79.9 33.3 79.5 33.3 79.1C33.3 78.7 33.3 78.3 33.3 77.9C33.3 77.5 33.3 77.1 33.3 76.7C33.3 76.3 33.3 75.9 33.3 75.6C33.3 75.2 33.3 74.8 33.3 74.4C33.3 74.0 33.3 73.6 33.3 73.2C33.3 72.8 33.3 72.4 33.3 72.0C33.3 71.6 33.3 71.2 33.3 70.8C33.3 70.4 33.3 70.0 33.3 69.6C33.3 69.2 33.3 68.8 33.3 68.4C33.3 68.0 33.3 67.6 33.3 67.2C33.3 66.8 33.3 66.4 33.3 66.0C33.3 65.6 33.3 65.2 33.3 64.8C33.3 64.4 33.3 64.0 33.3 63.6C33.3 63.2 33.3 62.8 33.3 62.4C33.3 62.0 33.3 61.7 33.3 61.3C33.3 60.9 33.3 60.5 33.3 60.1C33.3 59.7 33.3 59.3 33.3 58.9C33.3 58.5 33.3 58.1 33.3 57.7C33.3 57.3 33.3 56.9 33.3 56.5C33.3 56.1 33.3 55.7 33.3 55.3C33.3 54.9 33.3 54.5 33.3 54.1C33.3 53.7 33.3 53.3 33.3 52.9C33.3 52.5 33.3 52.1 33.3 51.7C33.3 51.3 33.3 50.9 33.3 50.5C33.3 50.1 33.3 49.7 33.3 49.3C33.3 48.9 33.3 48.5 33.3 48.1C33.3 47.8 33.3 47.4 33.3 47.0C33.3 46.6 33.3 46.2 33.3 45.8C33.3 45.4 33.3 45.0 33.3 44.6C33.3 44.2 33.3 43.8 33.3 43.4C33.3 43.0 33.3 42.6 33.3 42.2C33.3 41.8 33.3 41.3 33.3 41.0C33.3 40.7 33.3 40.4 33.2 40.2C33.2 39.9 33.2 39.6 33.2 39.3C33.2 39.1 33.2 38.8 33.2 38.5C33.2 38.2 33.2 37.8 33.2 37.5C33.1 37.2 33.1 36.8 33.1 36.5C33.1 36.2 33.1 35.8 33.0 35.5C33.0 35.2 32.9 34.8 32.9 34.5C32.8 34.2 32.8 33.8 32.7 33.5C32.7 33.2 32.6 32.8 32.6 32.5C32.6 32.2 32.5 31.8 32.5 31.5C32.4 31.2 32.4 30.8 32.3 30.5C32.3 30.2 32.1 29.8 32.1 29.5C32.0 29.2 31.9 28.8 31.8 28.5C31.7 28.2 31.6 27.8 31.5 27.5C31.4 27.2 31.2 26.8 31.1 26.5C31.0 26.2 31.0 25.8 30.9 25.5C30.8 25.2 30.7 24.8 30.6 24.5C30.5 24.2 30.5 23.8 30.4 23.5C30.3 23.2 30.1 22.8 29.9 22.5C29.8 22.2 29.7 21.8 29.5 21.5C29.3 21.2 29.2 20.8 29.0 20.5C28.8 20.2 28.7 19.8 28.5 19.5C28.3 19.2 28.2 18.8 28.0 18.5C27.8 18.2 27.6 17.8 27.4 17.5C27.3 17.2 27.1 16.9 27.0 16.7C26.8 16.4 26.7 16.1 26.5 15.8C26.4 15.6 26.3 15.3 26.1 15.0C25.9 14.7 25.7 14.3 25.5 14.0C25.2 13.7 25.0 13.3 24.8 13.0C24.6 12.7 24.5 12.6 24.3 12.3C24.2 12.1 24.0 11.9 23.9 11.7C23.7 11.4 23.6 11.2 23.4 11.0C23.2 10.8 23.1 10.6 22.9 10.3C22.7 10.1 22.6 9.9 22.4 9.7C22.2 9.4 22.1 9.2 21.9 9.0C21.7 8.8 21.4 8.5 21.1 8.2C20.9 8.0 20.6 7.7 20.4 7.5C20.2 7.3 20.0 7.1 19.9 6.8C19.7 6.6 19.5 6.4 19.3 6.2C19.2 5.9 19.0 5.7 18.8 5.5C18.6 5.3 18.4 5.1 18.3 4.8C18.1 4.6 17.9 4.4 17.7 4.2C17.6 3.9 17.4 3.7 17.2 3.5C17.0 3.3 16.8 3.1 16.7 2.8C16.5 2.6 16.3 2.4 16.1 2.2C16.0 1.9 15.7 1.8 15.6 1.5C15.5 1.2 15.6 0.8 15.6 0.5C15.6 0.1 20.9 -0.4 15.7 -0.5C10.4 -0.7 -10.4 -0.7 -15.7 -0.5Z","body_line":"M-15.63 -0.54C-15.62 -0.20 -14.78 0.18 -15.60 1.50C-16.42 2.82 -19.47 6.14 -20.54 7.37C-21.61 8.61 -21.54 8.29 -22.03 8.89C-22.53 9.48 -22.83 9.91 -23.50 10.93C-24.17 11.95 -25.09 13.25 -26.07 15.02C-27.04 16.79 -28.64 20.15 -29.34 21.57C-30.04 23.00 -29.96 22.72 -30.24 23.55C-30.52 24.38 -30.80 25.70 -31.04 26.53C-31.28 27.36 -31.50 27.86 -31.69 28.53C-31.88 29.20 -32.00 29.36 -32.18 30.53C-32.35 31.70 -32.59 34.21 -32.72 35.54C-32.84 36.87 -32.82 36.33 -32.93 38.51C-33.04 40.70 -33.33 42.71 -33.36 48.65C-33.39 54.58 -33.10 68.18 -33.10 74.13C-33.09 80.07 -33.31 80.07 -33.32 84.32C-33.34 88.57 -33.17 94.09 -33.21 99.61C-33.25 105.13 -33.56 111.93 -33.57 117.45C-33.57 122.97 -33.42 129.97 -33.26 132.74C-33.09 135.50 -32.84 133.68 -32.59 134.03C-32.34 134.38 -31.72 134.57 -31.77 134.84C-31.82 135.10 -32.69 135.18 -32.89 135.62C-33.08 136.05 -32.99 137.01 -32.94 137.45C-32.89 137.89 -32.83 138.07 -32.58 138.25C-32.32 138.44 -33.70 138.61 -31.41 138.57C-29.12 138.53 -21.35 138.09 -18.84 138.00C-16.33 137.91 -18.42 137.93 -16.33 138.03C-14.23 138.13 -8.37 138.49 -6.28 138.59C-4.19 138.68 -5.86 138.69 -3.77 138.59C-1.67 138.48 4.19 138.09 6.28 137.98C8.37 137.87 7.54 137.92 8.79 137.93C10.05 137.94 11.30 137.93 13.82 138.04C16.33 138.16 21.35 138.51 23.86 138.62C26.38 138.73 27.63 138.68 28.89 138.69C30.15 138.70 30.80 138.73 31.42 138.67C32.04 138.61 32.36 138.52 32.63 138.32C32.90 138.12 32.98 137.93 33.05 137.47C33.12 137.01 33.23 135.99 33.05 135.55C32.88 135.10 32.04 135.03 32.00 134.80C31.96 134.58 32.56 134.53 32.81 134.19C33.05 133.85 33.40 134.72 33.50 132.78C33.59 130.84 33.36 126.38 33.35 122.55C33.34 118.72 33.44 114.05 33.43 109.81C33.41 105.56 33.19 101.31 33.26 97.06C33.33 92.82 33.74 87.29 33.85 84.32C33.96 81.35 33.96 82.62 33.92 79.22C33.88 75.83 33.77 68.61 33.61 63.94C33.45 59.26 33.04 54.17 32.94 51.19C32.84 48.22 32.95 47.80 33.01 46.10C33.07 44.40 33.24 42.27 33.29 41.00C33.35 39.73 33.36 39.41 33.34 38.50C33.32 37.58 33.33 36.82 33.16 35.49C32.98 34.16 32.62 32.01 32.29 30.51C31.95 29.01 31.45 27.67 31.14 26.50C30.83 25.33 30.70 24.32 30.43 23.48C30.16 22.65 29.86 22.14 29.55 21.48C29.23 20.81 29.13 20.56 28.55 19.48C27.97 18.41 26.71 16.09 26.08 15.01C25.45 13.94 25.47 14.02 24.76 13.02C24.06 12.03 22.58 9.96 21.85 9.05C21.11 8.13 21.39 8.80 20.36 7.54C19.33 6.27 16.45 2.82 15.67 1.47C14.89 0.13 15.68 -0.20 15.68 -0.54","bead":"M-31.90 131.15C-31.57 131.19 -30.58 131.28 -29.92 131.34C-29.26 131.40 -28.59 131.46 -27.93 131.52C-27.27 131.59 -26.61 131.65 -25.95 131.72C-25.29 131.79 -24.63 131.86 -23.97 131.92C-23.30 131.99 -22.64 132.06 -21.98 132.13C-21.32 132.20 -20.66 132.29 -20.00 132.33C-19.34 132.37 -18.67 132.36 -18.00 132.38C-17.33 132.39 -16.67 132.41 -16.00 132.41C-15.33 132.42 -14.67 132.43 -14.00 132.44C-13.33 132.44 -12.66 132.43 -12.00 132.44C-11.33 132.44 -10.66 132.44 -10.00 132.45C-9.33 132.46 -8.66 132.48 -8.00 132.50C-7.33 132.52 -6.66 132.55 -6.00 132.59C-5.33 132.62 -4.67 132.66 -4.00 132.70C-3.33 132.73 -2.67 132.77 -2.00 132.81C-1.33 132.85 -0.67 132.90 0.00 132.91C0.67 132.93 1.34 132.91 2.00 132.91C2.67 132.90 3.34 132.90 4.00 132.88C4.67 132.87 5.34 132.86 6.00 132.84C6.67 132.81 7.34 132.79 8.00 132.76C8.67 132.73 9.34 132.69 10.00 132.65C10.67 132.62 11.33 132.58 12.00 132.54C12.67 132.51 13.33 132.48 14.00 132.44C14.66 132.40 15.33 132.37 16.00 132.33C16.66 132.29 17.33 132.25 18.00 132.21C18.66 132.17 19.32 132.16 19.99 132.10C20.65 132.05 21.30 131.95 21.96 131.89C22.62 131.82 23.28 131.77 23.94 131.72C24.61 131.66 25.27 131.62 25.93 131.57C26.60 131.53 27.26 131.49 27.92 131.45C28.59 131.41 29.25 131.38 29.92 131.33C30.58 131.29 31.57 131.19 31.90 131.16","shoulder":"M-31.59 29.98C-31.33 30.06 -30.55 30.29 -30.04 30.46C-29.53 30.64 -29.02 30.83 -28.52 31.02C-28.01 31.20 -27.54 31.44 -27.00 31.58C-26.45 31.72 -25.83 31.78 -25.25 31.87C-24.67 31.96 -24.09 32.05 -23.51 32.14C-22.92 32.23 -22.34 32.31 -21.76 32.39C-21.17 32.46 -20.29 32.57 -20.00 32.60","shine":["M-24.58 52.00C-24.61 52.36 -24.74 53.46 -24.77 54.19C-24.80 54.92 -24.77 55.65 -24.77 56.38C-24.78 57.11 -24.78 57.84 -24.78 58.57C-24.79 59.30 -24.79 60.03 -24.80 60.76C-24.80 61.49 -24.81 62.22 -24.82 62.95C-24.82 63.68 -24.83 64.41 -24.83 65.14C-24.83 65.87 -24.82 66.60 -24.82 67.33C-24.81 68.06 -24.80 68.79 -24.80 69.52C-24.80 70.25 -24.79 70.98 -24.80 71.71C-24.80 72.44 -24.81 73.17 -24.82 73.90C-24.83 74.63 -24.85 75.36 -24.86 76.09C-24.88 76.82 -24.90 77.55 -24.91 78.28C-24.92 79.01 -24.93 79.74 -24.93 80.47C-24.93 81.21 -24.93 81.94 -24.93 82.67C-24.93 83.40 -24.92 84.13 -24.92 84.86C-24.91 85.59 -24.90 86.32 -24.89 87.05C-24.89 87.78 -24.87 88.51 -24.87 89.24C-24.87 89.97 -24.87 90.70 -24.87 91.43C-24.88 92.16 -24.90 92.89 -24.92 93.62C-24.94 94.35 -24.97 95.08 -24.98 95.81C-25.00 96.54 -25.01 97.63 -25.02 98.00","M-24.67 105.00C-24.71 105.30 -24.87 106.20 -24.92 106.80C-24.96 107.40 -24.94 108.00 -24.93 108.60C-24.93 109.20 -24.92 109.80 -24.90 110.40C-24.88 111.00 -24.87 111.60 -24.84 112.20C-24.81 112.80 -24.74 113.70 -24.72 114.00"],"band":"M-17.00 -0.94C-22.72 -1.14 -17.30 -0.84 -17.30 -2.14C-17.30 -3.44 -22.72 -7.64 -17.00 -8.74C-11.28 -9.84 11.28 -9.84 17.00 -8.74C22.72 -7.64 17.30 -3.44 17.30 -2.14C17.30 -0.84 22.72 -1.14 17.00 -0.94C11.28 -0.74 -11.28 -0.74 -17.00 -0.94Z","band_line":"M-17.02 -0.94C-17.07 -1.14 -17.30 -1.72 -17.33 -2.14C-17.37 -2.56 -17.26 -3.02 -17.21 -3.46C-17.17 -3.90 -17.12 -4.34 -17.07 -4.77C-17.02 -5.21 -16.96 -5.65 -16.92 -6.09C-16.87 -6.53 -16.80 -7.00 -16.79 -7.41C-16.77 -7.81 -17.04 -8.33 -16.82 -8.52C-16.60 -8.71 -15.94 -8.50 -15.45 -8.52C-14.97 -8.54 -14.42 -8.60 -13.91 -8.64C-13.39 -8.68 -12.88 -8.72 -12.36 -8.76C-11.85 -8.80 -11.33 -8.83 -10.82 -8.86C-10.30 -8.88 -9.79 -8.90 -9.27 -8.92C-8.76 -8.93 -8.24 -8.95 -7.73 -8.95C-7.21 -8.95 -6.70 -8.95 -6.18 -8.93C-5.67 -8.92 -5.15 -8.90 -4.64 -8.88C-4.12 -8.86 -3.61 -8.84 -3.09 -8.81C-2.58 -8.78 -2.06 -8.75 -1.55 -8.71C-1.03 -8.68 -0.52 -8.64 0.00 -8.61C0.52 -8.57 1.03 -8.54 1.55 -8.51C2.06 -8.48 2.58 -8.45 3.09 -8.43C3.61 -8.42 4.12 -8.40 4.64 -8.40C5.15 -8.40 5.67 -8.41 6.18 -8.42C6.70 -8.44 7.21 -8.46 7.73 -8.49C8.24 -8.51 8.76 -8.54 9.27 -8.57C9.79 -8.60 10.30 -8.63 10.82 -8.65C11.33 -8.67 11.85 -8.70 12.36 -8.71C12.88 -8.73 13.39 -8.74 13.91 -8.75C14.42 -8.76 14.94 -8.76 15.45 -8.76C15.97 -8.76 16.74 -8.98 17.02 -8.76C17.29 -8.54 17.07 -7.86 17.09 -7.42C17.12 -6.98 17.14 -6.54 17.16 -6.10C17.19 -5.66 17.21 -5.22 17.24 -4.78C17.27 -4.34 17.30 -3.91 17.34 -3.46C17.37 -3.02 17.47 -2.57 17.43 -2.13C17.39 -1.68 17.42 -1.03 17.09 -0.81C16.76 -0.58 15.98 -0.78 15.45 -0.77C14.93 -0.77 14.42 -0.79 13.91 -0.80C13.39 -0.81 12.88 -0.83 12.36 -0.85C11.85 -0.87 11.33 -0.89 10.82 -0.91C10.30 -0.94 9.79 -0.96 9.27 -0.98C8.76 -1.00 8.24 -1.02 7.73 -1.04C7.21 -1.05 6.70 -1.06 6.18 -1.07C5.67 -1.08 5.15 -1.09 4.64 -1.09C4.12 -1.09 3.61 -1.09 3.09 -1.09C2.58 -1.09 2.06 -1.09 1.55 -1.09C1.03 -1.09 0.52 -1.09 0.00 -1.08C-0.52 -1.07 -1.03 -1.06 -1.55 -1.04C-2.06 -1.03 -2.58 -1.00 -3.09 -0.98C-3.61 -0.95 -4.12 -0.92 -4.64 -0.89C-5.15 -0.86 -5.67 -0.83 -6.18 -0.81C-6.70 -0.79 -7.21 -0.77 -7.73 -0.76C-8.24 -0.75 -8.76 -0.75 -9.27 -0.75C-9.79 -0.75 -10.30 -0.76 -10.82 -0.77C-11.33 -0.78 -11.85 -0.79 -12.36 -0.81C-12.88 -0.82 -13.39 -0.83 -13.91 -0.84C-14.42 -0.84 -14.94 -0.83 -15.45 -0.85C-15.97 -0.86 -16.74 -0.90 -17.00 -0.91","band_lip":"M-16.40 -7.68C-16.06 -7.69 -15.03 -7.73 -14.35 -7.73C-13.66 -7.73 -12.98 -7.69 -12.30 -7.67C-11.61 -7.65 -10.93 -7.63 -10.25 -7.60C-9.56 -7.57 -8.88 -7.55 -8.20 -7.51C-7.51 -7.48 -6.83 -7.45 -6.15 -7.42C-5.46 -7.39 -4.78 -7.35 -4.10 -7.32C-3.42 -7.28 -2.73 -7.25 -2.05 -7.22C-1.37 -7.19 -0.68 -7.13 0.00 -7.13C0.68 -7.12 1.37 -7.16 2.05 -7.18C2.73 -7.19 3.42 -7.22 4.10 -7.24C4.78 -7.26 5.47 -7.28 6.15 -7.30C6.83 -7.32 7.52 -7.34 8.20 -7.37C8.88 -7.39 9.57 -7.42 10.25 -7.44C10.93 -7.46 11.62 -7.48 12.30 -7.50C12.98 -7.52 13.67 -7.53 14.35 -7.55C15.03 -7.58 16.06 -7.62 16.40 -7.63","dome":"M-16.18 -9.49C-21.48 -9.74 -16.33 -9.86 -16.03 -10.99C-15.74 -12.11 -14.78 -14.36 -14.42 -16.24C-14.06 -18.11 -14.22 -20.36 -13.86 -22.24C-13.50 -24.11 -12.62 -25.61 -12.26 -27.49C-11.89 -29.36 -12.15 -31.49 -11.66 -33.49C-11.18 -35.49 -9.92 -38.24 -9.36 -39.49C-8.79 -40.74 -8.57 -40.81 -8.27 -40.99C-7.98 -41.16 -8.23 -40.47 -7.60 -40.54C-6.97 -40.61 -5.87 -41.20 -4.50 -41.39C-3.13 -41.58 -1.02 -41.72 0.60 -41.69C2.22 -41.66 3.87 -41.48 5.20 -41.19C6.53 -40.90 8.20 -39.97 8.60 -39.94C9.00 -39.91 7.41 -41.06 7.61 -40.99C7.81 -40.91 9.35 -39.86 9.81 -39.49C10.28 -39.11 10.23 -39.11 10.42 -38.74C10.60 -38.36 10.81 -38.24 10.94 -37.24C11.08 -36.24 10.89 -34.49 11.24 -32.74C11.58 -30.99 12.63 -28.61 13.00 -26.74C13.36 -24.86 13.08 -23.24 13.42 -21.49C13.76 -19.74 14.65 -18.24 15.04 -16.24C15.43 -14.24 20.94 -10.61 15.74 -9.49C10.53 -8.36 -10.89 -9.24 -16.18 -9.49Z","dome_line":"M-16.17 -9.49C-16.13 -9.74 -16.14 -10.30 -15.95 -10.97C-15.76 -11.65 -15.32 -12.68 -15.03 -13.55C-14.74 -14.42 -14.43 -14.76 -14.21 -16.20C-13.99 -17.64 -13.92 -20.77 -13.72 -22.21C-13.51 -23.65 -13.20 -23.96 -12.98 -24.84C-12.76 -25.72 -12.50 -26.57 -12.38 -27.52C-12.27 -28.46 -12.35 -29.51 -12.28 -30.52C-12.22 -31.53 -12.45 -32.06 -12.00 -33.57C-11.55 -35.08 -10.19 -38.33 -9.57 -39.60C-8.96 -40.87 -8.65 -41.02 -8.33 -41.20C-8.00 -41.38 -8.24 -40.67 -7.60 -40.68C-6.96 -40.70 -5.85 -41.18 -4.48 -41.30C-3.12 -41.42 -1.02 -41.44 0.59 -41.41C2.20 -41.37 3.84 -41.33 5.18 -41.09C6.51 -40.85 8.18 -39.96 8.59 -39.94C9.00 -39.92 7.44 -41.07 7.63 -40.98C7.82 -40.90 9.31 -39.81 9.76 -39.43C10.21 -39.04 10.14 -39.06 10.32 -38.69C10.51 -38.33 10.68 -38.21 10.85 -37.22C11.01 -36.23 11.07 -33.99 11.33 -32.76C11.59 -31.52 12.07 -30.82 12.41 -29.83C12.75 -28.84 13.21 -27.61 13.39 -26.81C13.57 -26.01 13.48 -25.90 13.50 -25.02C13.52 -24.13 13.42 -22.54 13.50 -21.50C13.58 -20.46 13.78 -19.67 13.97 -18.78C14.16 -17.89 14.42 -17.44 14.65 -16.16C14.87 -14.89 15.17 -12.25 15.33 -11.15C15.49 -10.06 17.03 -9.87 15.62 -9.60C14.21 -9.34 10.10 -9.61 6.87 -9.55C3.64 -9.49 -0.52 -9.24 -3.77 -9.25C-7.02 -9.25 -10.86 -9.51 -12.63 -9.57C-14.41 -9.63 -13.82 -9.61 -14.41 -9.60C-15.00 -9.59 -15.89 -9.54 -16.18 -9.53","flutes":["M-14.75 -11.91C-14.68 -11.98 -14.46 -12.18 -14.34 -12.34C-14.23 -12.49 -14.29 -12.50 -14.06 -12.84C-13.82 -13.18 -13.57 -13.69 -12.94 -14.38C-12.31 -15.07 -11.29 -16.12 -10.28 -16.98C-9.26 -17.83 -8.17 -18.58 -6.87 -19.50C-5.57 -20.41 -4.03 -21.37 -2.48 -22.47C-0.94 -23.57 0.97 -24.98 2.40 -26.08C3.82 -27.18 5.37 -28.50 6.07 -29.08C6.76 -29.66 6.41 -29.39 6.56 -29.55C6.72 -29.71 6.73 -29.69 6.99 -30.03C7.25 -30.37 7.85 -31.15 8.12 -31.58C8.38 -32.00 8.35 -32.19 8.56 -32.60C8.77 -33.00 9.18 -33.61 9.37 -34.01C9.57 -34.40 9.65 -34.72 9.73 -34.95C9.81 -35.19 9.83 -35.19 9.83 -35.44C9.83 -35.69 9.75 -36.27 9.74 -36.44","M-12.46 -23.44C-12.31 -23.69 -11.75 -24.62 -11.54 -24.95C-11.32 -25.28 -11.52 -25.02 -11.17 -25.44C-10.83 -25.86 -10.01 -26.86 -9.48 -27.46C-8.95 -28.06 -8.36 -28.70 -8.01 -29.04C-7.66 -29.39 -8.16 -29.00 -7.39 -29.55C-6.63 -30.10 -4.30 -31.72 -3.44 -32.36C-2.57 -32.99 -2.69 -32.91 -2.20 -33.34C-1.70 -33.77 -1.09 -34.31 -0.45 -34.93C0.20 -35.55 1.16 -36.53 1.65 -37.05C2.14 -37.57 2.31 -37.82 2.50 -38.06C2.68 -38.30 2.73 -38.34 2.76 -38.48C2.78 -38.62 2.63 -38.75 2.63 -38.91C2.63 -39.06 2.73 -39.35 2.75 -39.44","M-10.34 -34.43C-10.24 -34.59 -10.01 -34.97 -9.71 -35.38C-9.41 -35.79 -8.81 -36.56 -8.54 -36.90C-8.27 -37.24 -8.27 -37.24 -8.11 -37.42C-7.94 -37.59 -7.75 -37.76 -7.54 -37.93C-7.33 -38.10 -7.18 -38.27 -6.82 -38.43C-6.47 -38.59 -5.80 -38.74 -5.41 -38.90C-5.02 -39.07 -4.65 -39.33 -4.49 -39.42","M12.24 -9.94C12.31 -10.03 12.45 -10.12 12.69 -10.46C12.93 -10.80 13.44 -11.57 13.68 -11.99C13.91 -12.41 13.99 -12.64 14.11 -12.97C14.23 -13.29 14.35 -13.78 14.39 -13.94","M-5.06 -9.93C-4.62 -10.14 -3.12 -10.83 -2.39 -11.21C-1.66 -11.59 -2.00 -11.32 -0.69 -12.20C0.62 -13.07 4.21 -15.57 5.45 -16.45C6.70 -17.33 6.19 -16.97 6.78 -17.48C7.38 -17.98 8.41 -18.91 9.02 -19.50C9.62 -20.08 10.14 -20.64 10.43 -20.96C10.72 -21.29 10.57 -21.13 10.77 -21.47C10.96 -21.81 11.38 -22.49 11.59 -22.99C11.79 -23.50 11.88 -24.15 11.98 -24.48C12.08 -24.80 12.15 -24.87 12.19 -24.95"],"cap_shine":"M-10.51 -15.14C-10.55 -15.47 -10.69 -16.47 -10.77 -17.14C-10.86 -17.81 -10.94 -18.48 -11.02 -19.14C-11.11 -19.81 -11.19 -20.48 -11.28 -21.15C-11.37 -21.81 -11.53 -22.81 -11.58 -23.14"}};
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  let uid = 0;

  /* ---------- the drawings ---------- */
  // the face every character shares; F.y is the eyes' height, F.cdx the cheeks' spread
  function face(F) {
    const y = F.y, m = y + 13.5, c = y + 15, ink = 'stroke="var(--ama-ink)" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return `<g class="ama-face">
    <g class="ama-cheeks" fill="var(--ama-cheek)"><ellipse cx="${-F.cdx}" cy="${c}" rx="5" ry="2.9"/><ellipse cx="${F.cdx}" cy="${c}" rx="5" ry="2.9"/></g>
    <g class="ama-look"><g class="ama-eyes">
      <ellipse cx="-10.5" cy="${y}" rx="4.1" ry="5.9" fill="var(--ama-ink)"/><circle cx="-11.8" cy="${y - 2.4}" r="1.55" fill="#fff"/>
      <ellipse cx="10.5" cy="${y}" rx="4.1" ry="5.9" fill="var(--ama-ink)"/><circle cx="9.2" cy="${y - 2.4}" r="1.55" fill="#fff"/>
    </g></g>
    <g class="ama-mouths" ${ink} stroke-width="2.6">
      <path class="m m-smile" pathLength="1" d="M-8.6 ${m} Q0 ${m + 9.3} 8.6 ${m}"/>
      <path class="m m-grin" d="M-9 ${m - .9} Q0 ${m + .1} 9 ${m - .9} Q8 ${m + 10} 0 ${m + 10.1} Q-8 ${m + 10} -9 ${m - .9}Z" fill="var(--ama-ink)"/>
      <path class="m m-o" d="M-3 ${m + 3.9} a3 3.6 0 1 0 6 0 a3 3.6 0 1 0 -6 0" fill="var(--ama-ink)"/>
      <path class="m m-hmm" d="M-7.5 ${m + 4} q3.75 -3 7.5 0 t7.5 0"/>
    </g>
  </g>`;
  }
  const gradX = (id, x0, x1, stops) => `<linearGradient id="${id}" x1="${x0}" x2="${x1}" y1="0" y2="0" gradientUnits="userSpaceOnUse">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
  function wrap(id, C, o, defs, fills, lines) {
    const V = C.VB, lp = o.static ? '' : ' pathLength="1"';
    return `<svg class="ama-svg" viewBox="${V.x} ${V.y} ${V.w} ${V.h}" aria-hidden="true" focusable="false" overflow="visible">
  <defs>${defs}${o.static ? '' : `<filter id="${id}-boil" x="-20%" y="-10%" width="140%" height="120%">
      <feTurbulence class="ama-turb" type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="1" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter>`}</defs>
  <g class="ama-art"${o.static ? '' : ` filter="url(#${id}-boil)"`}>
    <g class="ama-fills">${fills}</g>
    <g class="ama-lines" stroke="var(--ama-ink)" fill="none" stroke-linecap="round" stroke-linejoin="round">${lines.replace(/ data-lp/g, lp)}</g>
  </g>
  ${face(C.face)}
</svg>`;
  }
  function artCan(id, C, o) {
    const g = GEO.can;
    return wrap(id, C, o,
      gradX(id + '-st', -34, 34, [[0, '#a9b8c1'], [.1, '#cfd9df'], [.24, '#f4f7f9'], [.36, '#dbe3e8'], [.7, '#c3ced5'], [.9, '#a7b6bf'], [1, '#93a4ae']])
      + gradX(id + '-cp', -18, 18, [[0, '#e3ecf1'], [.3, '#ffffff'], [.72, '#f1f6f8'], [1, '#cddfe8']]),
      `<path d="${g.body_fill}" fill="url(#${id}-st)"/><path d="${g.band}" fill="url(#${id}-cp)"/><path d="${g.dome}" fill="url(#${id}-cp)"/>
      <g stroke="#fff" stroke-linecap="round" fill="none"><path d="${g.shine[0]}" stroke-width="3.2" opacity=".9"/><path d="${g.shine[1]}" stroke-width="3.2" opacity=".9"/><path d="${g.cap_shine}" stroke-width="2.6"/></g>`,
      `<path class="ln" data-k="body" data-lp stroke-width="2.7" d="${g.body_line}"/>
      <path class="ln" data-k="band" data-lp stroke-width="2.7" d="${g.band_line}"/>
      <path class="ln" data-k="dome" data-lp stroke-width="2.7" d="${g.dome_line}"/>
      ${g.flutes.map((d, i) => `<path class="ln" data-k="flute" data-i="${i}" data-lp stroke-width="1.7" d="${d}"/>`).join('')}
      <path class="ln" data-k="detail" data-lp stroke-width="1.6" d="${g.bead}"/>
      <path class="ln" data-k="detail" data-lp stroke-width="1.5" d="${g.band_lip}"/>`);
  }
  /* ---------- the characters ---------- */
  const DECK = { ink: '#031b27', primary: '#014583', pale: '#d4f1ff', sky: '#8ae5ff', mark: '#e2fa8b', bg: '#fbf9f5' };
  const CHARS = {
    aerosol: {
      unit: 'Aerosol', name: 'AMA can', pack: '211 × 413 can', art: artCan, kind3d: 'can',
      VB: { x: -48, y: -50, w: 96, h: 197.6 }, base: 138.44, face: { y: 80, cdx: 19 }, colors: DECK,
      span: { body: [1.15, 1.85], dome: [1.3, 1.9], band: [1.35, 1.85], flute: [1.55, 1.95], detail: [1.7, 2.0] },
      eyebrow: 'Ask the deck', label: 'Ask the aerosol deck: search its pages, FAQ, glossary, dielines and batches',
      greet: 'Hi! Ask me anything about the aerosol deck.', placeholder: 'Try club pack, 604 or PFAS',
      chips: ['Which can for 15 oz?', 'Club packs', 'Cap colors', 'Sleeve or litho', 'Minimum order', 'PFAS', 'Dielines', '16.5 NBE'],
      hint: 'Try a shorter word, a can size (604, 713), a line (A to D) or an item code.',
      coverage: (X, c) => `Searches <b>${c((e) => e.ty === 'Page')} pages</b> and their sections, <b>${c((e) => e.ty === 'FAQ')} FAQ answers</b>, <b>${c((e) => e.ty === 'Term')} glossary terms</b>, `
        + `<b>${c((e) => e.ty === 'Row' && /Dieline/.test(e.p))} dielines</b>, part numbers and item codes, and <b>${X.B.length} batches</b>.`
    }
  };
  /* ---------- styles (the deck's tokens when the page has them) ---------- */
  const CSS = `
.ama { --ama-ink: #031b27; --ama-panel: #ffffff; --ama-bg: #fbf9f5; --ama-primary: #014583;
  --ama-pale: #d4f1ff; --ama-sky: #8ae5ff; --ama-lime: #e2fa8b; --ama-muted: #6f7378;
  --ama-body: var(--body, #5c5c61); --ama-line: rgba(92,92,97,.16); --ama-line-2: rgba(92,92,97,.4); --ama-cheek: rgba(255,150,136,.5);
  --ama-danger: var(--danger, #b3261e); --ama-bad-soft: var(--bad-soft, #fbe7e7); --ama-spring: cubic-bezier(.16,1,.3,1);
  --k: .643; --w: calc(var(--vw) * var(--k) * 1px); --h: calc(var(--vh) * var(--k) * 1px);
  position: fixed; z-index: 55; left: max(14px, calc(env(safe-area-inset-left, 0px) + 10px)); bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  font-family: var(--font, "DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif); color: var(--ama-ink); line-height: 1.4; }
.ama *, .ama *::before, .ama *::after { box-sizing: border-box; }
.ama[data-ready="0"] .ama-btn { visibility: hidden; }
.ama-btn { display: block; position: relative; width: var(--w); height: var(--h); margin: 0; padding: 0; border: 0; background: none; cursor: pointer;
  border-radius: 24px; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: transform .55s var(--ama-spring), opacity .25s ease; }
.ama-btn:focus-visible { outline: 3px solid var(--ama-primary); outline-offset: 5px; }
.ama-btn::before { content: ""; position: absolute; top: -6px; bottom: -6px; left: min(-6px, calc((var(--w) - 44px) / 2)); right: min(-6px, calc((var(--w) - 44px) / 2)); }
.ama-fig { position: absolute; inset: 0; transform-origin: 50% 97%; }
.ama-fig .ama-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ama-3d { position: absolute; left: 0; bottom: 0; width: 100%; height: 150%; pointer-events: none; }
.ama-shadow { position: absolute; left: 6%; right: 6%; bottom: calc(var(--sb) * var(--k) * 1px - 5px); height: 10px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgba(3,27,39,.24), rgba(3,27,39,0)); transform-origin: 50% 50%; }
.ama-svg .m { display: none; }
.ama[data-face="smile"] .m-smile, .ama[data-face="grin"] .m-grin, .ama[data-face="o"] .m-o, .ama[data-face="hmm"] .m-hmm { display: inline; }
.ama-svg .ama-look { transition: transform .28s ease-out; }
.ama-svg .ama-eyes { transform-box: fill-box; transform-origin: 50% 50%; transition: transform .07s ease-in; }
.ama-svg .ama-eyes.blink { transform: scaleY(.12); }
.ama[data-face="grin"] .ama-eyes { transform: scaleY(.82); }
/* alive: a slow breath; a wiggle on hover; a hop on click */
.ama.live .ama-fig { animation: amaBreath 3.8s ease-in-out infinite; }
@keyframes amaBreath { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(.994, 1.013); } }
.ama.live .ama-fig.wig { animation: amaWig .75s ease-in-out both; }
@keyframes amaWig { 0% { transform: rotate(0); } 18% { transform: rotate(-5deg); } 40% { transform: rotate(4deg); } 62% { transform: rotate(-2.4deg); } 82% { transform: rotate(1deg); } 100% { transform: rotate(0); } }
.ama .ama-fig.hop { animation: amaHop .82s both; }
.ama .ama-shadow.hop { animation: amaHopSh .82s both; }
@keyframes amaHop { 0% { transform: translateY(0) scale(1, 1); } 16% { transform: translateY(0) scale(1.07, .91); animation-timing-function: cubic-bezier(.2,.7,.4,1); }
  44% { transform: translateY(-28%) scale(.96, 1.05); animation-timing-function: cubic-bezier(.6,0,.9,.5); } 66% { transform: translateY(0) scale(1.08, .9); }
  82% { transform: translateY(0) scale(.98, 1.02); } 100% { transform: translateY(0) scale(1, 1); } }
@keyframes amaHopSh { 0%, 16% { transform: scale(1.05); opacity: 1; } 44% { transform: scale(.6); opacity: .45; } 66% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
.ama-pop { animation: amaPop .6s var(--ama-spring) both; }
@keyframes amaPop { from { opacity: 0; transform: translateY(18px) scale(.7); } }
/* the speech bubble */
.ama-bubble { position: absolute; left: calc(var(--w) + 10px); bottom: calc(var(--h) * var(--bf)); width: max-content; max-width: min(250px, calc(100vw - var(--w) - 56px));
  background: var(--ama-ink); color: var(--ama-bg); font-size: .86rem; font-weight: 600; padding: .5rem .85rem; border-radius: 14px 14px 14px 4px;
  opacity: 0; transform: translate(-6px, 8px) scale(.88); transform-origin: 0 100%; transition: opacity .18s ease, transform .4s var(--ama-spring); pointer-events: none; }
.ama-bubble::before { content: ""; position: absolute; left: -5px; bottom: 0; width: 12px; height: 10px; background: var(--ama-ink); clip-path: polygon(100% 0, 100% 100%, 0 100%); }
.ama.talk .ama-bubble { opacity: 1; transform: none; }
.ama.open .ama-bubble { opacity: 0; }
/* the search panel */
.ama-panel { position: absolute; left: calc(var(--w) + 16px); bottom: 0; width: min(420px, calc(100vw - var(--w) - 52px));
  max-height: min(600px, calc(100vh - 90px)); max-height: min(600px, calc(100dvh - 90px)); display: flex; flex-direction: column;
  background: var(--ama-panel); color: var(--ama-ink); border-radius: 20px; box-shadow: 0 26px 64px rgba(3,27,39,.24), 0 0 0 1px rgba(3,27,39,.07); transform-origin: 0 100%; }
.ama-panel::before { content: ""; position: absolute; left: -7px; bottom: max(14px, calc(var(--h) * var(--tf) - 7px)); width: 15px; height: 15px; background: var(--ama-panel); transform: rotate(45deg);
  box-shadow: -1px 1px 0 rgba(3,27,39,.07); border-radius: 0 0 0 3px; }
.ama-panel.in { animation: amaIn .5s var(--ama-spring) both; }
@keyframes amaIn { from { opacity: 0; transform: translateX(-12px) scale(.94); } }
.ama-hd { display: flex; align-items: flex-start; gap: .75rem; padding: 1rem 1rem .4rem 1.2rem; }
.ama-hd > div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
.ama-eb { display: flex; align-items: center; gap: .45rem; font-size: .7rem; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: var(--ama-muted); }
.ama-eb i { width: 8px; height: 8px; border-radius: 50%; background: var(--ama-sky); flex: none; }
.ama-hd h2 { margin: 0; font-size: 1.15rem; line-height: 1.25; font-weight: 700; color: var(--ama-ink); letter-spacing: -.01em; }
.ama-x { flex: none; width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--ama-line-2); background: transparent; color: var(--ama-ink); cursor: pointer; display: grid; place-items: center; transition: background .2s, border-color .2s; }
.ama-x:hover { background: var(--ama-pale); border-color: transparent; }
.ama-x:focus-visible, .ama-chip:focus-visible, .ama-more:focus-visible { outline: 3px solid var(--ama-primary); outline-offset: 2px; }
.ama-field { position: relative; margin: .35rem 1rem .6rem; }
.ama-field svg { position: absolute; left: .85rem; top: 50%; width: 17px; height: 17px; transform: translateY(-50%); color: var(--ama-muted); pointer-events: none; }
.ama-q { width: 100%; font: inherit; font-size: 1rem; color: var(--ama-ink); background: var(--ama-bg); border: 1px solid var(--ama-line-2); border-radius: 14px; padding: .72rem .9rem .72rem 2.5rem; -webkit-appearance: none; appearance: none; }
.ama-q::placeholder { color: var(--ama-muted); }
.ama-q:focus { outline: none; border-color: var(--ama-primary); box-shadow: 0 0 0 3px rgba(1,69,131,.16); background: var(--ama-panel); }
.ama-bd { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 .55rem .7rem; }
.ama-intro { padding: .2rem .65rem .4rem; display: flex; flex-direction: column; gap: .7rem; }
.ama-lab { font-size: .7rem; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: var(--ama-muted); }
.ama-chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.ama-chip { font: inherit; font-size: .82rem; font-weight: 600; padding: .38rem .85rem; border-radius: 999px; border: 1px solid var(--ama-line-2); background: var(--ama-panel); color: var(--ama-ink); cursor: pointer; transition: border-color .2s, color .2s, background .2s; }
.ama-chip:hover { border-color: var(--ama-primary); color: var(--ama-primary); }
.ama-cov { font-size: .84rem; color: var(--ama-body); }
.ama-cov b { color: var(--ama-ink); font-weight: 600; }
.ama-g { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; padding: .85rem .65rem .3rem; }
.ama-g:first-child { padding-top: .2rem; }
.ama-g small { font-size: .72rem; color: var(--ama-muted); }
.ama-r { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .1rem .6rem; padding: .62rem .65rem; border-radius: 12px; text-decoration: none; color: var(--ama-ink); outline: none; }
.ama-r:hover, .ama-r:focus-visible { background: color-mix(in srgb, var(--ama-pale) 55%, var(--ama-panel)); }
.ama-r:focus-visible { box-shadow: inset 0 0 0 2px var(--ama-primary); }
.ama-r > * { grid-column: 1; min-width: 0; }
.ama-r .go { grid-column: 2; grid-row: 1; align-self: start; color: var(--ama-muted); font-size: .95rem; transition: transform .2s, color .2s; }
.ama-r:hover .go, .ama-r:focus-visible .go { transform: translateX(3px); color: var(--ama-primary); }
.ama-r .t { font-size: .94rem; font-weight: 600; line-height: 1.3; }
.ama-r .p { font-size: .72rem; color: var(--ama-muted); letter-spacing: .02em; }
.ama-r .x { font-size: .86rem; color: var(--ama-body); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ama-r .a { font-size: .87rem; color: var(--ama-ink); opacity: .86; }
.ama-r .tg { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: .25rem; }
.ama-r .tg span { font-size: .7rem; font-weight: 500; padding: .1rem .5rem; border-radius: 999px; background: var(--ama-pale); color: var(--ama-ink); white-space: nowrap; }
.ama-r .tg span.xb { background: var(--ama-bad-soft); color: var(--ama-danger); }
.ama-r mark { background: var(--ama-lime); color: inherit; border-radius: 3px; padding: 0 1px; }
.ama-more { font: inherit; font-size: .82rem; font-weight: 600; color: var(--ama-primary); background: none; border: 0; padding: .35rem .65rem; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.ama-none { padding: .4rem .65rem; display: flex; flex-direction: column; gap: .6rem; font-size: .9rem; color: var(--ama-body); }
.ama-none b { color: var(--ama-ink); }
.ama-ft { display: flex; justify-content: space-between; gap: .75rem; padding: .55rem 1.1rem .65rem; border-top: 1px solid var(--ama-line); font-size: .74rem; color: var(--ama-muted); font-variant-numeric: tabular-nums; }
.ama-ft kbd { font: inherit; font-weight: 600; color: var(--ama-ink); }
.ama-soon { padding: .3rem 1.2rem 1.2rem; display: flex; flex-direction: column; align-items: flex-start; gap: .7rem; font-size: .92rem; color: var(--ama-body); }
.ama-soon b { color: var(--ama-ink); font-size: 1rem; }
.ama-soon .ama-pill { display: inline-flex; align-items: center; gap: .4rem; font-size: .72rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; padding: .25rem .65rem; border-radius: 999px; border: 1px dashed var(--ama-line-2); color: var(--ama-muted); }
.ama.soon .ama-panel { max-height: none; }
@media (hover: none), (max-width: 600px) { .ama-keys { display: none; } }
/* phones: smaller, and the search is a sheet the can stands on */
@media (max-width: 600px) {
  .ama { --k: .4656; }
  .ama-panel { position: fixed; left: max(12px, env(safe-area-inset-left, 0px)); right: max(12px, env(safe-area-inset-right, 0px)); bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    width: auto; height: min(68vh, 540px); height: min(68dvh, 540px); max-height: none; transform-origin: 40px 100%; }
  .ama-panel::before { display: none; }
  .ama-panel.in { animation-name: amaUp; }
  @keyframes amaUp { from { opacity: 0; transform: translateY(24px) scale(.97); } }
  .ama.open .ama-btn { transform: translateY(calc(-1 * var(--perch, 0px))); }
  .ama.open.tuck .ama-btn { opacity: 0; pointer-events: none; }
  .ama.soon .ama-panel { height: auto; }
  .ama-bubble { max-width: calc(100vw - var(--w) - 48px); }
}
@media (prefers-reduced-motion: reduce) {
  .ama *, .ama .ama-fig { animation: none !important; transition: none !important; }
}`;

  /* ---------- search ---------- */
  const STOP = new Set(('a an the of to in on for and or is are was be do does did we our us you your i me my it its am what which how when where who why with about '
    + 'any there this that these those get got have has need want show tell find please some give list vs versus per than into from at by many much').split(' '));
  const SUF = ['ability', 'ations', 'ation', 'ings', 'able', 'ing', 'ers', 'ies', 'ied', 'ed', 'es', 'er', 's', 'e'];
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/×/g, ' x ');
  // "12pk", "6-pack", "15oz": the count and the unit are two words, as the deck writes them
  const words = (s) => norm(s).replace(/\b(\d+)-?(pks?|packs?|ct|oz)\b/g, '$1 $2').match(/[a-z0-9]+(?:\.[0-9]+)?/g) || [];
  function stem(w) {
    if (w.length < 4 || /\d/.test(w)) return w;
    for (const s of SUF) if (w.endsWith(s) && w.length - s.length >= 3) return w.slice(0, -s.length) + (s === 'ies' || s === 'ied' ? 'y' : '');
    return w;
  }
  const toks = (s) => words(s).map(stem);
  // a few words people say that the deck spells another way (stemmed)
  const SYN = { n2o: ['nitrous'], nitrous: ['n2o'], nitrogen: ['n2'], moq: ['minimum'], minimum: ['moq'], min: ['minimum', 'moq'], lid: ['cap'], closur: ['cap'],
    cap: ['closur'], dielin: ['cad'], cad: ['dielin'], die: ['dielin'], shrink: ['sleev'], sleev: ['shrink'], print: ['litho'], litho: ['print'], truck: ['reefer', 'trailer'],
    trailer: ['truck', 'reefer'], reefer: ['truck', 'trailer'], ounce: ['oz'], oz: ['ounc'], plant: ['nondairy'], vegan: ['nondairy'], oat: ['nondairy'],
    pk: ['pack'], pack: ['pk'], eco: ['sustainability', 'recycl'], green: ['sustainability', 'recycl'], cost: ['tier', 'price'], price: ['cost', 'tier'], palett: ['pallet'], skid: ['pallet'] };

  function prep(ix) {
    const E = ix.entries.map((e) => ({ ...e, ts: toks(e.t).join(' '), T: new Set(toks(e.t)), X: new Set(toks([e.x, e.a, (e.tags || []).join(' '), e.l].join(' '))), P: new Set(toks(e.p)), K: new Set(toks(e.k)) }));
    const B = (ix.batches || []).map((b) => ({ ...b, ty: 'Batch', h: b.h || 'fq', N: new Set(toks(b.nm + ' ' + b.c)), K: new Set(toks(b.k)), I: new Set(words(b.it)) }));
    const df = new Map(), bump = (s) => s.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    E.forEach((e) => bump(new Set([...e.T, ...e.X, ...e.P, ...e.K])));
    B.forEach((b) => bump(new Set([...b.N, ...b.K, ...b.I])));
    const N = E.length + B.length;
    return { E, B, N, idf: (t) => Math.log(1 + N / ((df.get(t) || 0) + .5)), raw: ix };
  }
  function hit(set, q, alts, pre) {
    if (set.has(q)) return 1;
    for (const a of alts) if (set.has(a)) return .85;
    if (pre) for (const d of set) if (d.length > q.length && d.startsWith(q)) return .7;
    return 0;
  }
  function parse(q) {
    const raw = words(q), last = raw.length - 1;
    const Q = [];
    raw.forEach((w, i) => { if (STOP.has(w) && raw.length > 1) return; const s = stem(w); if (!Q.some((x) => x.q === s)) Q.push({ q: s, w, alts: SYN[s] || [], pre: s.length >= 3 || (i === last && s.length >= 2) }); });
    return Q;
  }
  const TYPEW = { FAQ: 1.2, Term: 1.1, Page: 1.05, Section: 1, Row: .95 };
  function search(X, q) {
    const Q = parse(q); if (!Q.length) return null;
    const tot = Q.reduce((s, t) => s + X.idf(t.q), 0), qs = Q.map((t) => t.q).join(' ');
    const out = [], part = [];
    X.E.forEach((e) => {
      let sc = 0, got = 0;
      Q.forEach((t) => {
        const f = X.idf(t.q), m = Math.max(3 * hit(e.T, t.q, t.alts, t.pre), 1.6 * hit(e.X, t.q, t.alts, t.pre), 1.1 * hit(e.P, t.q, t.alts, t.pre), .55 * hit(e.K, t.q, t.alts, t.pre));
        if (m) { sc += f * m; got += f; }
      });
      if (!got) return;
      if (qs.length >= 4 && (' ' + e.ts + ' ').includes(' ' + qs + ' ')) sc += 2.5 * tot / Q.length;
      sc *= TYPEW[e.ty] || 1;
      const cov = got / tot;
      if (cov > .999) out.push({ e, sc }); else if (Q.length >= 2 && cov >= .6) part.push({ e, sc: sc * .5 * cov });
    });
    const bat = [];
    X.B.forEach((b) => {
      let sc = 0, ok = true;
      Q.forEach((t) => {
        const m = Math.max(3 * hit(b.N, t.q, t.alts, t.pre), 1 * hit(b.K, t.q, t.alts, t.pre), 2.6 * (b.I.has(t.w) ? 1 : 0));
        if (m) sc += X.idf(t.q) * m; else ok = false;
      });
      if (ok) bat.push({ e: b, sc: sc - (b.x ? .01 : 0) });
    });
    const by = (a, b) => b.sc - a.sc;
    out.sort(by); part.sort(by); bat.sort(by);
    const partial = out.length < 3 && part.length > 0;
    return { Q, list: partial ? out.concat(part.slice(0, 8)) : out, bat, partial };
  }

  /* ---------- text helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mark(text, Q) {
    if (!Q || !Q.length) return esc(text);
    return String(text || '').split(/([A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ.]*)/).map((seg, i) => {
      if (i % 2 === 0) return esc(seg);
      const w = norm(seg).replace(/\.$/, ''), s = stem(w);
      const on = Q.some((t) => s === t.q || t.alts.includes(s) || (t.pre && s.startsWith(t.q)) || w === t.w);
      return on ? `<mark>${esc(seg)}</mark>` : esc(seg);
    }).join('');
  }
  function cut(s, n) { s = String(s || ''); if (s.length <= n) return s; const c = s.slice(0, n); return c.slice(0, c.lastIndexOf(' ')) + '…'; }
  function around(k, Q, n) {
    const m = String(k || '').match(/[A-Za-z0-9][A-Za-z0-9.]*/g) || [];
    let at = -1, pos = 0, idx = 0;
    for (const w of m) { const p = k.indexOf(w, idx); idx = p + w.length; const s = stem(norm(w)); if (Q.some((t) => s === t.q || (t.pre && s.startsWith(t.q)))) { at = p; break; } pos = p; }
    if (at < 0) return cut(k, n);
    const a = Math.max(0, at - Math.round(n * .35)), sl = k.slice(a, a + n);
    return (a > 0 ? '…' + sl.slice(sl.indexOf(' ') + 1) : sl) + (a + n < k.length ? '…' : '');
  }

  /* ---------- the widget ---------- */
  AF.amaIndexes = AF.amaIndexes || {};
  function mount(opts) {
    const o = Object.assign({ char: 'aerosol', link: (e) => '#' + e.h, target: '_self', indexSrc: {} }, opts || {});
    const key = CHARS[o.char] ? o.char : 'aerosol', C = CHARS[key];
    const introKey = (o.introKey || 'afAmaIntro.v1') + '.' + key;
    if (!document.getElementById('ama-css')) { const st = document.createElement('style'); st.id = 'ama-css'; st.textContent = CSS; document.head.appendChild(st); }
    const id = 'ama' + (++uid), V = C.VB, bottom = V.y + V.h;
    const ac = new AbortController(), sig = { signal: ac.signal }, timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const root = document.createElement('div');
    root.className = 'ama' + (C.soon ? ' soon' : ''); root.dataset.ready = '0'; root.dataset.face = 'smile'; root.dataset.unit = key;
    const K = C.colors;
    root.style.cssText = `--vw:${V.w};--vh:${V.h};--sb:${(bottom - C.base).toFixed(2)};--bf:${((bottom - C.face.y) / V.h + .12).toFixed(3)};--tf:${((bottom - C.face.y) / V.h).toFixed(3)};`
      + `--ama-ink:${K.ink};--ama-primary:${K.primary};--ama-pale:${K.pale};--ama-sky:${K.sky};--ama-lime:${K.mark};--ama-bg:${K.bg};`;
    const searchUI = C.soon
      ? `<div class="ama-soon"><span class="ama-pill">Coming soon</span><b>${esc(C.soon.title)}</b><span>${esc(C.soon.text)}</span>${o.onSwitch && C.soon.alt ? `<button type="button" class="ama-chip ama-alt">${esc(C.soon.altLabel)}</button>` : ''}</div>`
      : `<div class="ama-field"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m13 13 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <label for="${id}-q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Search ${esc(C.unit)}</label>
          <input class="ama-q" id="${id}-q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="${esc(C.placeholder)}"></div>
        <div class="ama-bd" id="${id}-bd"></div>
        <div class="ama-ft"><span class="ama-n" aria-live="polite"></span><span class="ama-keys"><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Esc</kbd> to close</span></div>`;
    root.innerHTML = `
      <div class="ama-bubble" aria-hidden="true"><span></span></div>
      <button class="ama-btn" type="button" aria-expanded="false" aria-controls="${id}-panel" aria-label="${esc(C.label)}">
        <span class="ama-shadow"></span><span class="ama-fig">${C.art(id, C, {})}</span>
      </button>
      <section class="ama-panel" id="${id}-panel" role="dialog" aria-label="${esc(C.eyebrow)}" hidden>
        <div class="ama-hd"><div><span class="ama-eb"><i></i>${esc(C.eyebrow)}</span><h2>${C.soon ? esc(C.unit) + ' is coming soon' : 'What do you need to know?'}</h2></div>
          <button class="ama-x" type="button" aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
        ${searchUI}
      </section>`;
    document.body.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const btn = $('.ama-btn'), fig = $('.ama-fig'), sh = $('.ama-shadow'), svg = $('.ama-svg'), panel = $('.ama-panel'), q = $('.ama-q'), bd = $('.ama-bd'), nEl = $('.ama-n');
    const bubble = $('.ama-bubble span'), look = $('.ama-look'), eyes = $('.ama-eyes'), turb = $('.ama-turb');
    const S = { open: false, live: false, idx: null, X: null, last: '', faceT: 0, talkT: 0, px: null, py: null, idleT: 0, res: null, dead: false };
    const reduce = () => reduceMQ.matches;

    /* --- face, eyes, talking --- */
    const face = (f, ms) => { root.dataset.face = f; clearTimeout(S.faceT); if (ms) S.faceT = later(() => { root.dataset.face = S.open && S.last && S.res && !S.res.list.length && !S.res.bat.length ? 'hmm' : 'smile'; }, ms); };
    function talk(text, ms) { clearTimeout(S.talkT); bubble.textContent = text; root.classList.add('talk'); if (ms) S.talkT = later(() => root.classList.remove('talk'), ms); }
    const hush = () => { clearTimeout(S.talkT); root.classList.remove('talk'); };
    function aim(x, y) {   // look toward a point on screen
      if (reduce()) return;
      const r = svg.getBoundingClientRect(); if (!r.width) return;
      const ex = r.left + (0 - V.x) / V.w * r.width, ey = r.top + (C.face.y - V.y) / V.h * r.height;
      const c = (v) => Math.max(-1, Math.min(1, v));
      look.style.transform = `translate(${(c((x - ex) / 150) * 2.6).toFixed(2)}px, ${(c((y - ey) / 150) * 2.2).toFixed(2)}px)`;
    }
    const center = () => { look.style.transform = ''; };
    const aimInput = () => { const t = q || $('.ama-soon b'); if (!t) return; const r = t.getBoundingClientRect(); if (r.width) aim(r.left + Math.min(r.width * .3, 120), r.top + r.height / 2); };
    let raf = 0;
    window.addEventListener('pointermove', (e) => {
      if (!S.live || e.pointerType === 'touch') return;
      S.px = e.clientX; S.py = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!S.dead) aim(S.px, S.py); });
      clearTimeout(S.idleT); S.idleT = later(() => { if (S.open) aimInput(); else center(); }, 3500);
    }, { passive: true, signal: ac.signal });
    function blinkLoop() {
      if (!S.live || reduce() || S.dead) return;
      later(() => {
        if (!document.hidden && root.dataset.face !== 'grin') {
          eyes.classList.add('blink'); later(() => eyes.classList.remove('blink'), 130);
          if (Math.random() < .22) later(() => { eyes.classList.add('blink'); later(() => eyes.classList.remove('blink'), 120); }, 300);
        }
        blinkLoop();
      }, 2400 + Math.random() * 3800);
    }
    // the line boils: three hand-drawn frames, about eight a second
    let boilI = 0, boilT = 0;
    function boil(on) { clearInterval(boilT); if (on && turb && !reduce() && !S.dead) boilT = setInterval(() => { if (!document.hidden) turb.setAttribute('seed', [1, 7, 13][boilI = (boilI + 1) % 3]); }, 125); }
    function hop() {
      if (reduce()) return;
      fig.classList.remove('hop', 'wig'); sh.classList.remove('hop'); void fig.offsetWidth; fig.classList.add('hop'); sh.classList.add('hop');
      later(() => { fig.classList.remove('hop'); sh.classList.remove('hop'); }, 850);
    }
    // now and then, when nobody is busy with it, a little hop
    let napT = 0;
    const nap = () => { clearTimeout(napT); napT = later(() => { if (S.live && !S.open && !root.matches(':hover') && !document.hidden) hop(); nap(); }, 45000); };

    /* --- hover, click --- */
    btn.addEventListener('pointerenter', (e) => {
      if (!S.live || e.pointerType === 'touch') return;
      if (!S.open) { talk('Ask me anything'); face('grin'); if (!reduce() && !fig.classList.contains('hop')) { fig.classList.remove('wig'); void fig.offsetWidth; fig.classList.add('wig'); } }
    }, sig);
    btn.addEventListener('pointerleave', () => { if (!S.open) { hush(); face('smile'); } fig.classList.remove('wig'); }, sig);
    btn.addEventListener('focus', () => { if (S.live && !S.open && btn.matches(':focus-visible')) talk('Ask me anything'); }, sig);
    btn.addEventListener('blur', () => { if (!S.open) hush(); }, sig);
    btn.addEventListener('click', () => { if (!S.live) return; S.open ? close() : open(); }, sig);
    $('.ama-x').addEventListener('click', () => close(true), sig);
    document.addEventListener('pointerdown', (e) => { if (S.open && !root.contains(e.target)) close(); }, sig);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && S.open) { e.preventDefault(); close(true); return; }
      if (!bd) return;
      const rs = [...bd.querySelectorAll('.ama-r')], i = rs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { if (document.activeElement === q || i >= 0) { e.preventDefault(); (rs[i + 1] || rs[0] || q).focus(); } }
      else if (e.key === 'ArrowUp') { if (i >= 0) { e.preventDefault(); (i === 0 ? q : rs[i - 1]).focus(); } }
      else if (i >= 0 && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { q.focus(); }
    }, sig);
    if (bd) bd.addEventListener('focusin', (e) => { const r = e.target.closest('.ama-r'); if (r) { const b = r.getBoundingClientRect(); aim(b.left + 40, b.top + b.height / 2); } }, sig);
    const alt = $('.ama-alt');
    if (alt) alt.addEventListener('click', () => { close(); o.onSwitch(C.soon.alt); }, sig);

    /* --- the index, loaded when the search first opens --- */
    function loadIndex() {
      if (S.X) return Promise.resolve(S.X);
      if (!S.idx) S.idx = (AF.amaIndexes[key] ? Promise.resolve(AF.amaIndexes[key]) : loadScript(o.indexSrc[key]).then(() => AF.amaIndexes[key]))
        .then((ix) => { if (!ix) throw new Error('no index'); S.X = prep(ix); return S.X; });
      return S.idx;
    }
    function open() {
      S.open = true; root.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); hush();
      panel.hidden = false; panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
      perch(); hop(); face('smile');
      if (!C.soon) {
        render();
        loadIndex().then(() => { if (!S.dead) render(); }, () => { bd.innerHTML = `<div class="ama-none"><b>The search didn’t load.</b><span>Check your connection, then close this and open it again.</span></div>`; S.idx = null; });
      }
      later(() => { (q || alt || $('.ama-x')).focus({ preventScroll: true }); aimInput(); }, reduce() ? 0 : 180);
    }
    function close(refocus) {
      if (!S.open) return;
      S.open = false; root.classList.remove('open', 'tuck'); btn.setAttribute('aria-expanded', 'false');
      panel.hidden = true; face('smile'); center();
      if (refocus || root.contains(document.activeElement)) btn.focus({ preventScroll: true });
    }
    function perch() {   // phones: the character stands on the sheet's top edge, or steps aside if there is no room
      root.style.removeProperty('--perch'); root.classList.remove('tuck');
      if (!matchMedia('(max-width: 600px)').matches) return;
      const ph = panel.getBoundingClientRect().height, bh = btn.getBoundingClientRect().height;
      if (window.innerHeight - ph - 24 > bh) root.style.setProperty('--perch', (ph + 2) + 'px'); else root.classList.add('tuck');
    }
    window.addEventListener('resize', () => { if (S.open) perch(); }, sig);

    /* --- rendering the results --- */
    function render() {
      const v = q.value.trim(); S.last = v;
      if (!v) {
        S.res = null;
        bd.innerHTML = `<div class="ama-intro"><span class="ama-lab">Try one of these</span><div class="ama-chips">${C.chips.map((c) => `<button type="button" class="ama-chip">${esc(c)}</button>`).join('')}</div>
          <p class="ama-cov">${S.X ? C.coverage(S.X, (f) => S.X.E.filter(f).length) : 'Loading…'}</p></div>`;
        nEl.textContent = '';
        return;
      }
      if (!S.X) { bd.innerHTML = `<div class="ama-none">Loading…</div>`; return; }
      const R = S.res = search(S.X, v);
      if (!R || (!R.list.length && !R.bat.length)) {
        bd.innerHTML = `<div class="ama-none"><b>Nothing matches “${esc(v)}”.</b><span>${esc(C.hint)}</span>
          <div class="ama-chips">${C.chips.slice(0, 4).map((c) => `<button type="button" class="ama-chip">${esc(c)}</button>`).join('')}</div></div>`;
        nEl.textContent = 'No matches'; face('hmm');
        return;
      }
      const groups = [
        { k: 'ans', name: 'Answers', items: R.list.filter((r) => r.e.ty === 'FAQ' || r.e.ty === 'Term'), n: 3 },
        { k: 'pg', name: 'Pages and sections', items: R.list.filter((r) => r.e.ty === 'Page' || r.e.ty === 'Section'), n: 4 },
        { k: 'ref', name: C.refGroup || 'Reference tables', items: R.list.filter((r) => r.e.ty === 'Row'), n: 3 },
        { k: 'bat', name: 'Batches', items: R.bat, n: 3 }
      ].filter((g) => g.items.length).sort((a, b) => b.items[0].sc * (b.k === 'bat' ? .8 : 1) - a.items[0].sc * (a.k === 'bat' ? .8 : 1));
      const total = R.list.length + R.bat.length;
      bd.innerHTML = (R.partial ? `<div class="ama-none" style="padding-bottom:0"><span>No result has every word. These come closest.</span></div>` : '')
        + groups.map((g) => `<div class="ama-grp" data-g="${g.k}"><div class="ama-g"><span class="ama-lab">${g.name}</span><small>${g.items.length}</small></div>
          ${g.items.slice(0, g.n).map((r) => row(r.e, R.Q)).join('')}
          ${g.items.length > g.n ? `<button type="button" class="ama-more" data-g="${g.k}" data-n="${g.n}">Show ${g.items.length - g.n} more</button>` : ''}</div>`).join('');
      bd._groups = groups;
      nEl.textContent = total === 1 ? '1 match' : `${total} matches`;
      if (root.dataset.face === 'hmm') face('smile');
      bd.scrollTop = 0;
    }
    const BADGE = { regular: 'Regular', flavored: 'Flavored', coldfoam: 'Cold foam', nondairy: 'Non-dairy', coconut: 'Coconut', review: 'Product type pending' };
    const href = (e) => esc(o.link(e, key));
    function row(e, Q) {
      const tgt = o.target === '_blank' ? ' target="_blank" rel="noopener"' : '', go = '<span class="go" aria-hidden="true">→</span>';
      if (e.ty === 'Batch') {
        const tags = [BADGE[e.cat] || '', e.org ? 'Organic' : ''].filter(Boolean).map((t) => `<span>${t}</span>`).join('') + (e.x ? '<span class="xb">Restricted · new formula only</span>' : '');
        return `<a class="ama-r" href="${href(e)}"${tgt} data-ty="Batch" data-c="${esc(e.c)}"><span class="t">${mark(e.nm, Q)}</span>${go}<span class="p">Batch ${mark(e.c, Q)} · ${e.n} item${e.n === 1 ? '' : 's'} · opens the MOQ calculator</span>${tags ? `<span class="tg">${tags}</span>` : ''}</a>`;
      }
      if (e.ty === 'FAQ' || e.ty === 'Term') {
        const tg = (e.tags || []).map((t) => `<span>${esc(t)}</span>`).join('');
        return `<a class="ama-r" href="${href(e)}"${tgt} data-ty="${e.ty}"><span class="t">${mark(e.t, Q)}</span>${go}<span class="a">${mark(cut(e.a, 240), Q)}</span>`
          + `<span class="p">${e.ty === 'FAQ' ? `FAQ · opens ${esc(e.l)}` : esc(e.p)}</span>${tg ? `<span class="tg">${tg}</span>` : ''}</a>`;
      }
      const x = e.x || around(e.k, Q, 150);
      return `<a class="ama-r" href="${href(e)}"${tgt} data-ty="${e.ty}"><span class="t">${mark(e.t, Q)}</span>${go}<span class="p">${esc(e.p)}</span>${x ? `<span class="x">${mark(x, Q)}</span>` : ''}</a>`;
    }
    if (bd) bd.addEventListener('click', (e) => {
      const chip = e.target.closest('.ama-chip');
      if (chip) { q.value = chip.textContent; render(); q.focus(); if (S.res && (S.res.list.length || S.res.bat.length)) face('grin', 1200); return; }
      const more = e.target.closest('.ama-more');
      if (more) {
        const g = (bd._groups || []).find((x) => x.k === more.dataset.g), n = +more.dataset.n;
        more.insertAdjacentHTML('beforebegin', g.items.slice(n).map((r) => row(r.e, S.res.Q)).join(''));
        const first = more.parentElement.querySelectorAll('.ama-r')[n]; more.remove(); if (first) first.focus();
        return;
      }
      const r = e.target.closest('.ama-r');
      if (r && o.onJump) {
        const all = S.res ? S.res.list.map((x) => x.e).concat(S.res.bat.map((x) => x.e)) : [];
        const ent = r.dataset.ty === 'Batch' ? all.find((x) => x.ty === 'Batch' && x.c === r.dataset.c) : all.find((x) => esc(o.link(x, key)) === r.getAttribute('href') && x.ty === r.dataset.ty);
        o.onJump(ent, e, api);
      }
    }, sig);
    // while typing it says "o"; when the typing settles it grins if there is an answer
    let qt = 0, st = 0;
    if (q) q.addEventListener('input', () => {
      if (S.X && q.value.trim()) face('o');
      clearTimeout(qt); qt = later(render, 90);
      clearTimeout(st); st = later(() => { if (!S.open) return; if (S.res && (S.res.list.length || S.res.bat.length)) face('grin', 1200); else if (!q.value.trim()) face('smile'); }, 650);
    }, sig);

    /* --- the intro --- */
    const lines = [...svg.querySelectorAll('.ln')], fills = svg.querySelector('.ama-fills'), smile = svg.querySelector('.m-smile'), cheeks = svg.querySelector('.ama-cheeks');
    const T = { fill: [1.85, 2.35], fade3d: [1.95, 2.45], eyes: [2.35, 2.62], cheeks: [2.5, 2.72], smile: [2.5, 2.82], blink: 2.98, hop: 3.15, end: 3.4 };
    const cl = (v) => Math.max(0, Math.min(1, v)), io = (v) => v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;
    const back = (v) => { const c = 1.9; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
    const outC = (v) => 1 - Math.pow(1 - v, 3);
    let three = null, cv = null;
    function pose(t) {   // the 3D pack: falls in, lands with a squash and one small bounce, turns two and a half times to face front, tilts upright
      const fall = cl(t / .52), s = cl(t / 1.3);
      const land = t > .52 && t < .74 ? Math.sin(Math.PI * (t - .52) / .22) : 0, land2 = t > 1.02 && t < 1.16 ? Math.sin(Math.PI * (t - 1.02) / .14) * .45 : 0;
      const y = t < .52 ? 160 * (1 - fall * fall) : t > .7 && t < 1.02 ? 16 * Math.sin(Math.PI * (t - .7) / .32) : 0;
      return { y, ry: -2.5 * Math.PI * (1 - outC(s)), rx: .5 * (1 - outC(s)), sx: 1 + .06 * (land + land2), sy: 1 - .1 * (land + land2) };
    }
    // a line drawn on from its start: one dash the length of the line, slid along; hidden outright at 0, so round caps leave no dot
    function ink(p, v) { p.style.strokeDashoffset = (1.02 * (1 - v)).toFixed(4); p.style.opacity = v > 0 ? '' : '0'; }
    function frame(t, has3d) {
      lines.forEach((p) => { const [a, b] = C.span[p.dataset.k]; const k = +(p.dataset.i || 0) * .06; ink(p, io(cl((t - a - k) / (b - a)))); });
      const f = io(cl((t - T.fill[0]) / (T.fill[1] - T.fill[0])));
      fills.style.clipPath = `inset(${((1 - f) * 100).toFixed(2)}% 0 0 0)`;
      if (!has3d) fig.style.opacity = String(cl((t - .9) / .3));
      if (cv) cv.style.opacity = String(Math.min(cl(t / .15), 1 - io(cl((t - T.fade3d[0]) / (T.fade3d[1] - T.fade3d[0])))));
      const e = cl((t - T.eyes[0]) / (T.eyes[1] - T.eyes[0]));
      eyes.style.transform = e >= 1 ? '' : `scale(${Math.max(.001, back(e)).toFixed(3)})`;
      cheeks.style.opacity = String(cl((t - T.cheeks[0]) / (T.cheeks[1] - T.cheeks[0])));
      ink(smile, io(cl((t - T.smile[0]) / (T.smile[1] - T.smile[0]))));
      if (three) { if (t < T.fade3d[1] + .05) three.frame(pose(t)); else drop3d(); }
    }
    function prime() { lines.concat(smile).forEach((p) => { p.style.strokeDasharray = '1 2'; ink(p, 0); }); fills.style.clipPath = 'inset(100% 0 0 0)'; eyes.style.transform = 'scale(.001)'; cheeks.style.opacity = '0'; }
    function drop3d() { if (three) { three.dispose(); three = null; } if (cv) { cv.remove(); cv = null; } }
    function clean() {
      lines.concat(smile).forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.opacity = ''; });
      fills.style.clipPath = ''; eyes.style.transform = ''; cheeks.style.opacity = ''; fig.style.opacity = '';
    }
    function goLive(greet) {
      S.live = true; root.classList.add('live'); boil(true); blinkLoop(); nap();
      if (greet) { talk(C.greet, 5200); face('grin', 1600); }
    }
    let run = null;
    function play(kind) {
      if (run) run.stop();
      clean(); if (kind !== 'morph') drop3d(); S.live = false; root.classList.remove('live'); boil(false);
      root.dataset.ready = '1';
      if (kind === 'still') { goLive(false); return; }
      if (kind === 'pop') { fig.classList.add('ama-pop'); later(() => { fig.classList.remove('ama-pop'); goLive(false); }, 620); return; }
      prime();
      const has3d = !!three, off = has3d ? 0 : 1.0;   // without the 3D, the drawing starts at once
      if (!has3d) fig.style.opacity = '0';
      let t0 = performance.now(), stopped = false, hopped = false, blinked = false, boiled = false;
      const step = (now) => {
        if (stopped || S.dead) return;
        const t = (now - t0) / 1000 + off;
        frame(t, has3d);
        if (!boiled && t > T.eyes[0]) { boiled = true; boil(true); }
        if (!blinked && t > T.blink) { blinked = true; eyes.classList.add('blink'); later(() => eyes.classList.remove('blink'), 130); }
        if (!hopped && t > T.hop) { hopped = true; hop(); }
        if (t < T.end) requestAnimationFrame(step);
        else { clean(); drop3d(); boil(false); goLive(true); try { localStorage.setItem(introKey, '1'); } catch (e) { /* storage off: it plays again next time */ } run = null; }
      };
      run = { stop: () => { stopped = true; }, seek: (t) => { stopped = true; frame(t, has3d); } };
      requestAnimationFrame(step);
    }
    function softGL(gl) { try { const x = gl.getExtension('WEBGL_debug_renderer_info'); return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gl.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); } catch (e) { return false; } }
    async function intro(force) {
      drop3d();
      if (reduce()) return play('still');
      let seen = false; try { seen = localStorage.getItem(introKey) === '1'; } catch (e) { /* treat as first visit */ }
      if (seen && !force) return play('pop');
      // first visit: the 3D pack, if WebGL is real and three.js and the 3D file arrive in time
      try {
        await Promise.race([Promise.all([window.THREE ? 0 : loadScript(o.threeSrc), AF.amaMorph3D ? 0 : loadScript(o.src3d)]), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
        if (S.dead) return;
        cv = document.createElement('canvas'); cv.className = 'ama-3d'; fig.insertBefore(cv, fig.firstChild);
        const r = btn.getBoundingClientRect();
        three = AF.amaMorph3D.start(cv, r.width, r.height * 1.5, V, C.kind3d, C.base);
        if (three && softGL(three.gl)) { three.dispose(); three = null; }
        if (!three) { cv.remove(); cv = null; }
      } catch (e) { if (cv) { cv.remove(); cv = null; } three = null; }
      if (!S.dead) play('morph');
    }
    function whenVisible(fn) { if (!document.hidden) fn(); else document.addEventListener('visibilitychange', function v() { if (!document.hidden) { document.removeEventListener('visibilitychange', v); fn(); } }, sig); }
    document.addEventListener('visibilitychange', () => boil(S.live && !document.hidden), sig);
    reduceMQ.addEventListener && reduceMQ.addEventListener('change', () => { boil(S.live && !reduce()); if (reduce()) { if (run) { run.stop(); run = null; } clean(); drop3d(); center(); if (!S.live) goLive(false); } }, sig);

    const api = {
      el: root, key,
      open: () => { if (S.live) open(); }, close: () => close(),
      search: (v) => { if (C.soon) { if (!S.open) open(); return; } if (!S.open) open(); q.value = v; render(); },
      replay: () => { close(); hush(); intro(true); },
      seek: (t) => { if (run) run.seek(t); }, face,
      // the site rebuilds its index when its data changes: drop the prepared copy so the next search uses the new one
      reindex: () => { S.X = null; S.idx = null; if (S.open && !C.soon) loadIndex().then(() => { if (!S.dead) render(); }, () => {}); },
      destroy: () => { S.dead = true; if (run) run.stop(); ac.abort(); timers.forEach(clearTimeout); timers.clear(); clearInterval(boilT); drop3d(); root.remove(); }
    };
    later(() => whenVisible(() => intro(false)), o.delay == null ? 450 : o.delay);
    return api;
  }

  function loadScript(src) {
    return new Promise((ok, no) => {
      if (!src) return no(new Error('no source'));
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => ok(); s.onerror = () => no(new Error('did not load: ' + src)); document.head.appendChild(s);
    });
  }

  AF.ama = { mount, CHARS, art: (key, id) => CHARS[key].art(id, CHARS[key], { static: true }), search: (ix, q) => search(prep(ix), q) };
})();
