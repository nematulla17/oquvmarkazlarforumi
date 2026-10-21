# Video fayllar

Hero bo'limi quyidagi faylni avtomatik ishlatadi:

- `assets/video/hero.mp4` — asosiy hero video (ovozsiz, 10–30 soniya, 1920×1080, H.264, 5 MB dan oshmasin)
- `assets/video/hero.webm` — ixtiyoriy, Chrome/Android uchun yengilroq variant

Desktop'dagi `projectai/yangi oquvmarkazlarforumi` papkasidagi videoni shu nom bilan shu papkaga ko'chiring.
Fayl bo'lmasa sayt `assets/img/hero-poster.svg` posterini ko'rsatadi, hech narsa buzilmaydi.

Videoni siqish uchun (ffmpeg):

```
ffmpeg -i original.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 28 -preset slow -movflags +faststart hero.mp4
ffmpeg -i original.mp4 -an -vf "scale=1920:-2" -c:v libvpx-vp9 -b:v 0 -crf 36 hero.webm
```

Mobil uchun trafikni tejash maqsadida video faqat 768px dan keng ekranlarda yuklanadi
(`js/main.js` ichidagi `VIDEO_MIN_WIDTH` qiymati orqali o'zgartiriladi).
