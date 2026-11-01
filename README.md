# Sitting Sala Scala

Aplicación web para organizar el sitting de Sala Scala (dinner show): plano editable de la sala en dos plantas y reparto automático de las reservas del día a partir de un Excel.

## Cómo abrirla

1. Descomprime la carpeta.
2. Abre `index.html` con un navegador (Chrome, Edge, Safari o Firefox), en ordenador, tablet o móvil.
3. Hace falta conexión a internet la primera vez, porque el lector de Excel (SheetJS) se carga desde `cdnjs.cloudflare.com`.

Si quieres usarla desde varios dispositivos con la misma dirección, sube la carpeta tal cual a cualquier alojamiento de páginas estáticas (GitHub Pages, Netlify, el servidor de la empresa…). No necesita servidor ni base de datos.

## Estructura

```
sitting_eventos/
├── index.html             Página principal (botones, pestañas y zonas de la pantalla)
├── css/estilos.css        Colores y aspecto
├── js/plano-oficial.js    Distribución oficial de mesas de las dos plantas (datos)
├── js/app.js              Toda la lógica: editor del plano, sitting automático y dibujo
└── ejemplos/              Excel de reservas de prueba
    ├── reservas-sala-scala.xlsx   47 reservas de prueba (plantilla con instrucciones)
    └── reservas-sala-llena.xlsx   90 reservas que llenan toda la sala (plano definitivo)
```

## Uso diario

1. **Plano:** arranca siempre bloqueado. Pulsa «Plano bloqueado» para desbloquearlo si necesitas mover, añadir, girar o borrar mesas, y vuelve a bloquearlo al terminar.
2. **Sitting:** en «Sitting automático», pulsa «Cargar Excel de reservas» y elige el Excel del día.
   - Las mesas se colorean por categoría: VIP verde, Premium rosa, General azul y Show naranja.
   - Las reservas con PMR llevan contorno rojo. ⚠ marca alergias o intolerancias y 🎂 los cumpleaños.
   - Los puntos verdes indican dónde se sienta cada persona.
3. **Ajustes a mano:** arrastra una reserva a una mesa libre para moverla, o a una ocupada para intercambiarlas. Toca una mesa para ver el detalle de su reserva.
4. **Planta alta:** la barra del anfiteatro se ve en la pestaña «Planta alta». Cada reserva de la barra lleva un número de mesa desde el 500.

## Dónde se guardan los datos

- El plano se guarda solo en el navegador del dispositivo (localStorage). Cada dispositivo tiene su propia copia.
- **Exportar plano:** descarga un archivo `.json` con las dos plantas. Úsalo como copia de seguridad o para pasar el plano a otro dispositivo con **Importar plano**.
- **Restaurar plano oficial:** vuelve a la distribución de `js/plano-oficial.js` (hay que pulsarlo dos veces).
- Las reservas del Excel no se guardan en ningún sitio: solo se leen en el navegador mientras está abierto.

## Excel de reservas

Una fila por reserva, en una hoja con estas columnas (los nombres deben coincidir; el orden da igual):

| Columna | Contenido |
|---|---|
| Nº reserva | Localizador de Janto |
| Nombre reserva | Nombre de quien reserva |
| Categoría | Show, General, Premium o VIP |
| Menús Nomad / Menús veganos / Menús niño | Número de entradas de cada menú (en Show: adultos en Nomad y niños en Menú niño) |
| Total personas | Se calcula solo |
| Alergias | Texto libre, tal como lo escribe el cliente |
| Nº PMR | Personas en silla de ruedas (0 si ninguna) |
| Cumpleaños | Sí o No |
| Código de grupo | Mismo código para reservas separadas que vienen juntas |
| Observaciones | Texto libre |
| Invitación / personal | No, Invitación, Familia/amigos o Trabajador |

`ejemplos/reservas-sala-scala.xlsx` sirve de plantilla: borra las filas de prueba y añade las reservas reales.

## Reglas del sitting (resumen)

- **Orden de ubicación:** VIP → Premium → invitaciones y personal → General → barra del anfiteatro.
- **VIP:** solo en los 15 VIP, sin compartir. Los grupos de más de 4 ocupan VIP pegados. En los laterales se llenan primero los más cercanos a los VIP centrales.
- **Premium:** en las 12 mesas de 8 que rodean la pasarela.
- **Invitaciones, familia/amigos y trabajadores:** primero en los huecos de las mesas de Premium; si no hay, en las mesas General más centradas. Nunca en VIP de forma automática.
- **General:**
  - primero en las mesas de 8 libres, después en sus mesas;
  - las parejas pasan a las mesas de 2 de los muros cuando lo demás está lleno;
  - las personas solas, a las mesas de 2;
  - solo cuando toda la planta baja está llena, suben a la barra.
- **Barra del anfiteatro** (50 sillas repartidas a lo largo de toda la barra, zona PMR, cada PMR ocupa 2 sillas):
  - General con PMR, totalmente centrada; después Show con PMR a su lado;
  - luego el resto de General y, alrededor, el resto de Show;
  - las personas solas se agrupan en un mismo lado;
  - siempre queda una silla libre entre reservas.
- **Sillones de la planta alta:** 7 sillones de 2 personas, cada uno con su mesa redonda delante. La visibilidad es muy mala, así que son la última opción para General y Show, cuando ya no queda sitio en la barra.
- **Dentro de cada mesa:** la gente se sienta cara a cara (por parejas enfrentadas, no uno al lado del otro), empezando por los asientos más lejanos al escenario (pegados al escenario hay que forzar el cuello); si sobra una persona, va al lado con visión al escenario. Las reservas sí se acercan al escenario al elegir mesa.

Las reglas completas, con lo pendiente de confirmar, están en los documentos del proyecto de Claude: «entradas-y-reglas-sitting» y «mapa-sala-scala».

## Dónde cambiar cosas en el código

| Quiero cambiar… | Dónde |
|---|---|
| La distribución oficial de mesas | `js/plano-oficial.js` (lo más fácil: colócala en la app, pulsa «Exportar plano» y copia el contenido) |
| Medidas o plazas de un tipo de mesa | `js/app.js`, objeto `T` (busca «Tipos de mesa») |
| Escenario, pasarela, pasillos y muros | `js/app.js`, llamadas a `zone(...)` y `wall(...)` |
| Número de sillas de la barra | `js/app.js`, constante `BARRA_SILLAS` (ahora 50) |
| Reglas del sitting | `js/app.js`, función `runSitting` (cada paso está comentado) |
| Colores de las categorías | `js/app.js`, constante `CATC` |

## Pendiente

- Numeración real de las mesas de planta baja. Por ahora se usan V1–V15 para los VIP y M1… para el resto de mesas.
- Qué entradas van en las mesas de 6 y de 2 de la planta alta.
- Medida real de los sillones (ahora 1,80 × 0,80 m, provisional) y su posición exacta.
