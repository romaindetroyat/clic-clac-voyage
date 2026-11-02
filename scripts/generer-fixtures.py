"""Photos de test synthétiques (aucune donnée réelle) pour les tests E2E de l'import.
Usage : python3 scripts/generer-fixtures.py"""
import math, random
from PIL import Image, ImageDraw

OUT = "tests/e2e/fixtures"

def scene(graine, l=1600, h=1200):
    random.seed(graine)
    im = Image.new("RGB", (l, h))
    d = ImageDraw.Draw(im)
    c1 = [random.randint(0, 255) for _ in range(3)]
    c2 = [random.randint(0, 255) for _ in range(3)]
    for y in range(h):
        t = y / h
        d.line([(0, y), (l, y)], fill=tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3)))
    for _ in range(12):
        x, y, r = random.randint(0, l), random.randint(0, h), random.randint(40, 300)
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(random.randint(0, 255) for _ in range(3)))
    return im

def exif(date, decalage, marque, modele, serie):
    e = Image.Exif()
    e[0x010F] = marque
    e[0x0110] = modele
    ifd = e.get_ifd(0x8769)
    ifd[0x9003] = date          # DateTimeOriginal
    ifd[0x9011] = decalage      # OffsetTimeOriginal
    ifd[0xA431] = serie         # BodySerialNumber
    return e

r1 = scene(1)
r1.save(f"{OUT}/IMG_0001.jpg", quality=90, exif=exif("2026:08:03 14:00:00", "+03:00", "Apple", "iPhone 15", "A1"))
scene(2).save(f"{OUT}/IMG_0002.jpg", quality=90, exif=exif("2026:08:03 14:30:00", "+03:00", "Apple", "iPhone 15", "A1"))
# L'appareil de Paul retardait de 1 h 12 : sa photo « 13:00 » a été prise à 14:12.
scene(3).save(f"{OUT}/DSCF1234.jpg", quality=90, exif=exif("2026:08:03 13:00:00", "+03:00", "FUJIFILM", "X-T5", "F123"))
# La même photo que IMG_0001, passée par WhatsApp : réduite, recompressée, sans EXIF.
r1.resize((800, 600), Image.LANCZOS).save(f"{OUT}/IMG-20260803-WA0001.jpg", quality=60)
print("ok")
