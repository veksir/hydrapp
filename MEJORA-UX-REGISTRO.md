# Mejora de UX en el registro de bebidas — Ejecución

> Documento de decisión de producto. Originalmente notas para implementación;
> a fecha 2026-08-03 el plan P1-P3 ya está **EJECUTADO e implementado en el
> código** (verificado línea a línea). Fecha del documento: 2026-08-02.

Estado del contexto: el backend está maduro (ver `informe-QA-backend-hydrapp.txt`).
El frontend resolvió la funcionalidad (3ª y 4ª tanda: logout, perfil, tragos de
hoy, factor visible, alertas, H3/H4/M3/M5/M6/M8). Este documento era el pendiente
NUEVO de UX/animación y quedó completamente resuelto.

---

## 1. Observación de producto (decisor)

> Me gusta la dirección de esta propuesta porque no busca añadir más
> funcionalidades, sino mejorar la percepción de una interacción que el usuario
> repetirá muchas veces al día. Ese tipo de mejoras suelen tener mucho impacto en
> cómo se percibe la calidad de una aplicación.
>
> Hay una idea que me parece especialmente importante: cuando el usuario registra
> una bebida, la aplicación debería hacerle sentir que avanzó. Si después de esa
> acción lo que más llama la atención es que la página se mueve, estamos
> reforzando el elemento equivocado. El progreso debería ser el protagonista de
> esa experiencia.
>
> También creo que debemos tener cuidado de no sacrificar la inmediatez por
> mantener el Dashboard limpio. Ver el registro recién creado forma parte de la
> recompensa de usar la aplicación. Si todo se mueve al Historial, esa sensación
> se pierde.
>
> Solo dejaría una reflexión para la evolución del producto: cada vez que el
> usuario complete una acción importante, deberíamos preguntarnos "¿qué queremos
> que recuerde cinco segundos después?". En este caso, no debería recordar que
> apareció un nuevo elemento en una lista; debería recordar que está más cerca de
> su objetivo diario.
>
> Si esa sensación se consigue, el usuario percibirá la aplicación como más
> inteligente y agradable sin que haya cambiado ninguna funcionalidad.

---

## Principio de producto

HydrApp no busca únicamente registrar agua, sino hacer que el usuario perciba 
claramente el avance hacia una mejor hidratación. Cada interacción importante
debe generar una respuesta inmediata, comprensible y localizada en el lugar
donde el usuario espera verla. Si el usuario registra una bebida, la sensación
principal debe ser que avanzó hacia su objetivo, no que la interfaz cambió.

---

## 2. Diagnóstico técnico (por qué se sentía mal — contexto)

- Antes, "Hoy registraste" quedaba al PIE del dashboard (`Dashboard.jsx`). Al
  añadir un trago se insertaba una fila que **empujaba hacia abajo** toda la
  tarjeta de biblioteca y el CTA de síntomas. Resultado: *layout shift* con lo
  único que se "movía" visible era la página, no el progreso.
- El anillo (RingProgress) y el `%` no reaccionaban de forma destacada al cambio:
  el conteo y el fill no animaban, así que el ojo no tenía dónde recibir la
  "recompensa".

## 3. Decisión de producto

1. **El progreso es el protagonista.** La gratificación se pone en el anillo y los
   números (count-up del `consumed_ml` y fill del ring), no en empujar el layout.
2. **Se conserva la inmediatez**: el registro recién creado sigue visible en el
   Dashboard, NO se mueve solo al Historial. La línea del día pertenece al panel.
3. **No se añade funcionalidad**: solo percepción.

## 4. Implementar (orden por impacto) — ESTADO: TODOS EJECUTADOS

> Ejecutado el 2026-08-03. Cada punto indica el archivo/línea donde quedó.

### P1 — Reubicar la lista + estabilizar el layout ✅
- `today-logs` movido justo después del hero del anillo (`Dashboard.jsx:215`),
  ANTES de `StatusCards`; el resto de la página queda estable.
- Con más de 5 registros se colapsa (`TodayLogs.jsx:7,18`: muestra los 5 más
  recientes con botón "Ver N más") más un enlace "Ver historial completo"
  → `/historial`. Ya no hay un mar interminable.
- Archivos: `Dashboard.jsx`, `TodayLogs.jsx`, `TodayLogs.css`.

### P2 — Animación del anillo / números ✅
- **Count-up** de `consumed_ml`: `useCountUp()` en `RingProgress.jsx:17-46`
  (650ms, ease-out cúbico, 0→valor con rAF).
- **Fill del ring** con transición de `stroke-dashoffset` (`RingProgress.css:7-9`,
  0.7s cubic-bezier).
- **Pulso/brillo sutil y único** al cruzar el 100%: `RingProgress.jsx:56-64`
  (celebrate → `ring-progress--celebrate`) con animaciones `ring-pulse` y
  `ring-glow` (`RingProgress.css:36-52`).
- Respeta `prefers-reduced-motion` (conteo y celebrate desactivados).
- Archivos: `RingProgress.jsx`, `RingProgress.css`, `Dashboard.jsx`.

### P3 — Animación de entrada/salida de cada trago ✅
- **Nuevo registro**: destello de fondo + fade (highlight `today-logs__item--new`,
  se apaga a los 1.1s, `TodayLogs.jsx:55-62`).
- **Eliminar:** colapso + fade antes de borrar (`REMOVE_ANIM_MS=240`,
  `today-logs__item--removing`, `TodayLogs.jsx:21-25`).
- **Vibración háptica** `navigator.vibrate(30)` al registrar (`Dashboard.jsx:115`).

### Reglas (aplicadas en la implementación)
- Solo se anima `transform`/`opacity` (+ colapso puntual) → 60fps.
- Duración 200–300ms (count-up 650ms y transición de ring 0.7s, medidas).
- Desactivado por `prefers-reduced-motion`.

## 5. Pendientes asociados (para no mezclar)
Los hallazgos del informe de usuarios siguen vigentes y son independientes de
esta mejora (resueltos en la 3ª/4ª tanda):
- H3 auto-refresh del Dashboard, H4 push, M3 clima en onboarding, M5 historial
  vs meta, M6 insights honestos, M8 cola offline → TODOS resueltos.
- Diseño: iconos vectoriales y elevación/sombras → TAMBIÉN ejecutados (ver README §7).

---
Estado de este documento: **EJECUTADO al 100% (P1-P3) el 2026-08-03**. Verificado
en el código; se conserva como registro de la decisión de producto y de los
archivos que quedaron tocados.