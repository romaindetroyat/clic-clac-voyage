/**
 * Rendu des retouches sur GPU (WebGL2) : aperçu en direct dans l'éditeur, versions web « cuites »,
 * et plus tard rendu pleine résolution du livre dans un Chromium sans écran.
 * Les formules sont celles de `couleur.ts` et `geometrie.ts`, à l'identique (test d'équivalence ΔE).
 */
import { geometrie, tailleSortie } from "./geometrie";
import type { Retouche } from "./parametres";

const VERTEX = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D img;
uniform vec2 sortie;        // taille du résultat (px)
uniform vec2 source;        // taille de la source (px)
uniform vec2 cadre;         // cadre après quarts de tour (px)
uniform vec4 recadrage;     // x, y, l, h
uniform float angle;        // radians, sens horaire
uniform float zoom;
uniform float lumiere, contraste, hautesLumieres, ombres, blancs, noirs;
uniform float temperature, teinte, saturation;
uniform float vibrance, clarte, voile, nettete, vignettage;
uniform float pas;          // pixels de la source par pixel du résultat (netteté, clarté)
uniform int filtre;         // 0 aucun, 1 noir et blanc, 2 argentique, 3 chaud, 4 froid
uniform float intensite;
out vec4 couleur;

float versLineaire(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float versSrgb(float c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(max(c, 0.0), 1.0 / 2.4) - 0.055; }

float lum(vec3 c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
vec3 lire(vec2 q, vec2 d) { return texture(img, (q + d) / source + 0.5).rgb; }

float tonalite(float x) {
  x += noirs * 0.15 * pow(1.0 - x, 4.0);
  x += ombres * 0.4 * 4.0 * x * (1.0 - x) * (1.0 - x);
  x += hautesLumieres * 0.4 * 4.0 * x * x * (1.0 - x);
  x += blancs * 0.15 * pow(x, 4.0);
  x = 0.5 + (x - 0.5) * (1.0 + contraste * 0.8);
  return clamp(x, 0.0, 1.0);
}

void main() {
  // Géométrie : point du résultat → point de la source.
  vec2 uv = vec2(gl_FragCoord.x / sortie.x, 1.0 - gl_FragCoord.y / sortie.y);
  vec2 f = recadrage.xy + uv * recadrage.zw;
  vec2 p = (f - 0.5) * cadre;
  float c = cos(-angle), s = sin(-angle);
  vec2 q = vec2(p.x * c - p.y * s, p.x * s + p.y * c) / zoom;
  vec3 rgb = lire(q, vec2(0.0));
  // Netteté et clarté : mêmes voisins que cpu.ts (à pas pixels de la source).
  if (nettete > 0.0) {
    vec3 n = (lire(q, vec2(pas, 0.0)) + lire(q, vec2(-pas, 0.0)) + lire(q, vec2(0.0, pas)) + lire(q, vec2(0.0, -pas))) / 4.0;
    rgb = clamp(rgb + nettete * 1.5 * (rgb - n), 0.0, 1.0);
  }
  if (clarte != 0.0) {
    float d6 = 6.0 * pas;
    float lm = (lum(lire(q, vec2(d6, d6))) + lum(lire(q, vec2(-d6, d6))) + lum(lire(q, vec2(d6, -d6))) + lum(lire(q, vec2(-d6, -d6)))) / 4.0;
    float lb = lum(rgb);
    float delta = clarte * 0.8 * (lb - lm) * (1.0 - (2.0 * lb - 1.0) * (2.0 * lb - 1.0));
    rgb = clamp(rgb + delta, 0.0, 1.0);
  }

  // Couleur : mêmes étapes que couleur.ts.
  float R = versLineaire(rgb.r), G = versLineaire(rgb.g), B = versLineaire(rgb.b);
  R *= 1.0 + 0.3 * temperature;
  B *= 1.0 - 0.3 * temperature;
  G *= 1.0 - 0.25 * teinte;
  float gain = pow(2.0, lumiere * 2.0);
  R *= gain; G *= gain; B *= gain;
  R = tonalite(clamp(versSrgb(R), 0.0, 1.0));
  G = tonalite(clamp(versSrgb(G), 0.0, 1.0));
  B = tonalite(clamp(versSrgb(B), 0.0, 1.0));
  float L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  float sat = 1.0 + saturation;
  R = clamp(L + (R - L) * sat, 0.0, 1.0);
  G = clamp(L + (G - L) * sat, 0.0, 1.0);
  B = clamp(L + (B - L) * sat, 0.0, 1.0);
  if (vibrance != 0.0) {
    float k = 1.0 + vibrance * (1.0 - (max(R, max(G, B)) - min(R, min(G, B)))) * 0.8;
    L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    R = clamp(L + (R - L) * k, 0.0, 1.0);
    G = clamp(L + (G - L) * k, 0.0, 1.0);
    B = clamp(L + (B - L) * k, 0.0, 1.0);
  }
  if (voile != 0.0) {
    float h = voile * 0.1;
    R = clamp((R - h) / (1.0 - h), 0.0, 1.0);
    G = clamp((G - h) / (1.0 - h), 0.0, 1.0);
    B = clamp((B - h) / (1.0 - h), 0.0, 1.0);
    L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    float k = 1.0 + voile * 0.2;
    R = clamp(L + (R - L) * k, 0.0, 1.0);
    G = clamp(L + (G - L) * k, 0.0, 1.0);
    B = clamp(L + (B - L) * k, 0.0, 1.0);
  }
  if (filtre != 0 && intensite > 0.0) {
    L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    vec3 fl;
    if (filtre == 1) fl = vec3(L);
    else if (filtre == 2) {
      vec3 m = mix(vec3(L), vec3(R, G, B), 0.85);
      vec3 d = 0.06 + 0.88 * (0.5 + (m - 0.5) * 0.9);
      fl = vec3(d.r * 1.03, d.g, d.b * 0.95);
    }
    else if (filtre == 3) fl = vec3(R * 1.06, G * 1.01, B * 0.92);
    else fl = vec3(R * 0.93, G, B * 1.07);
    vec3 m2 = clamp(mix(vec3(R, G, B), fl, intensite), 0.0, 1.0);
    R = m2.r; G = m2.g; B = m2.b;
  }
  if (vignettage != 0.0) {
    float d = length(uv - 0.5) * 1.41421356;
    float k = 1.0 + vignettage * 0.7 * smoothstep(0.35, 1.0, d);
    R = clamp(R * k, 0.0, 1.0);
    G = clamp(G * k, 0.0, 1.0);
    B = clamp(B * k, 0.0, 1.0);
  }
  couleur = vec4(R, G, B, 1.0);
}`;

const FILTRES = { aucun: 0, "noir-et-blanc": 1, argentique: 2, chaud: 3, froid: 4 } as const;

type Source = TexImageSource & { width: number; height: number };

/** Un moteur par canevas : réutilisable pour l'aperçu en direct (seuls les réglages changent). */
export class MoteurRendu {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private texture: WebGLTexture;
  private source: { largeur: number; hauteur: number } | null = null;

  constructor(public readonly canevas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canevas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false }) as
      | WebGL2RenderingContext
      | null;
    if (!gl) throw new Error("WebGL2 indisponible");
    this.gl = gl;
    const compiler = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compiler(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compiler(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "programme");
    this.prog = prog;
    gl.useProgram(prog);
    const tampon = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture()!;
  }

  /** Charge l'image source (une seule fois pour tous les réglages successifs). */
  charger(image: Source) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.source = { largeur: image.width, hauteur: image.height };
  }

  /** Dessine le résultat dans le canevas, au plus grand côté demandé. */
  rendre(r: Retouche, coteMax: number): [number, number] {
    if (!this.source) throw new Error("Aucune image chargée");
    const gl = this.gl;
    const { largeur, hauteur } = this.source;
    const g = geometrie(r, largeur, hauteur);
    const [l, h] = tailleSortie(g, coteMax);
    this.canevas.width = l;
    this.canevas.height = h;
    gl.viewport(0, 0, l, h);
    const u = (n: string) => gl.getUniformLocation(this.prog, n);
    gl.uniform2f(u("sortie"), l, h);
    gl.uniform2f(u("source"), largeur, hauteur);
    gl.uniform2f(u("cadre"), g.cadreL, g.cadreH);
    gl.uniform4f(u("recadrage"), g.recadrage.x, g.recadrage.y, g.recadrage.l, g.recadrage.h);
    gl.uniform1f(u("angle"), g.angle);
    gl.uniform1f(u("zoom"), g.zoom);
    gl.uniform1f(u("pas"), Math.max(1, Math.max(largeur, hauteur) / Math.max(l, h)));
    for (const k of ["lumiere", "contraste", "hautesLumieres", "ombres", "blancs", "noirs", "temperature", "teinte", "saturation", "intensite", "vibrance", "clarte", "voile", "nettete", "vignettage"] as const) {
      gl.uniform1f(u(k), r[k]);
    }
    gl.uniform1i(u("filtre"), FILTRES[r.filtre]);
    gl.uniform1i(u("img"), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return [l, h];
  }

  /** Pixels du résultat, de haut en bas (pour les tests d'équivalence). */
  lirePixels(l: number, h: number): Uint8ClampedArray {
    const gl = this.gl;
    const brut = new Uint8Array(l * h * 4);
    gl.readPixels(0, 0, l, h, gl.RGBA, gl.UNSIGNED_BYTE, brut);
    const out = new Uint8ClampedArray(l * h * 4);
    for (let y = 0; y < h; y++) out.set(brut.subarray((h - 1 - y) * l * 4, (h - y) * l * 4), y * l * 4);
    return out;
  }
}
