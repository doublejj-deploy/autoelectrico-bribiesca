// Base de datos inicial para Servicio Autoeléctrico Bribiesca
const INITIAL_DATABASE = {
  "Clientes": [
    {
      "ID_Cliente": "CLI-001",
      "Nombre_Completo": "Juan P\u00e9rez G\u00f3mez",
      "Telefono": "5551234567",
      "Email": "juan.perez@email.com",
      "Direccion": "Av. Hidalgo 123, Centro",
      "RFC_Facturacion": "PEGJ800101AA1",
      "Fecha_Registro": "2026-10-01",
      "Notas": "Cliente frecuente"
    },
    {
      "ID_Cliente": "CLI-002",
      "Nombre_Completo": "Mar\u00eda Elena Torres",
      "Telefono": "5559876543",
      "Email": "m.torres@email.com",
      "Direccion": "Calle Morelos 45, Col. Ju\u00e1rez",
      "RFC_Facturacion": "TOEM850512BB2",
      "Fecha_Registro": "2026-10-03",
      "Notas": "Factura requerida"
    },
    {
      "ID_Cliente": "CLI-003",
      "Nombre_Completo": "Roberto Carlos Ruiz",
      "Telefono": "5555551212",
      "Email": "rruiz@email.com",
      "Direccion": "Blv. Las Torres 789",
      "RFC_Facturacion": null,
      "Fecha_Registro": "2026-10-05",
      "Notas": "Recomendado por Taller Morales"
    }
  ],
  "Vehiculos": [
    {
      "ID_Vehiculo": "VEH-001",
      "ID_Cliente": "CLI-001",
      "Marca": "Nissan",
      "Modelo": "Versa",
      "Anio": 2018,
      "Placa": "ABC-123-A",
      "Color": "Gris",
      "Numero_Serie_VIN": "3N1CN7AP5KL123456",
      "Kilometraje_Actual": 85400,
      "Tipo_Combustible": "Gasolina",
      "Foto_Vehiculo": null
    },
    {
      "ID_Vehiculo": "VEH-002",
      "ID_Cliente": "CLI-002",
      "Marca": "Chevrolet",
      "Modelo": "Aveo",
      "Anio": 2020,
      "Placa": "XYZ-987-B",
      "Color": "Blanco",
      "Numero_Serie_VIN": "3G1JB5SF0LL654321",
      "Kilometraje_Actual": 42150,
      "Tipo_Combustible": "Gasolina",
      "Foto_Vehiculo": null
    },
    {
      "ID_Vehiculo": "VEH-003",
      "ID_Cliente": "CLI-003",
      "Marca": "Ford",
      "Modelo": "Ranger",
      "Anio": 2015,
      "Placa": "LMN-456-C",
      "Color": "Rojo",
      "Numero_Serie_VIN": "8AFBR22D3FJ789012",
      "Kilometraje_Actual": 145000,
      "Tipo_Combustible": "Diesel",
      "Foto_Vehiculo": null
    }
  ],
  "Tecnicos": [
    {
      "ID_Tecnico": "TEC-001",
      "Nombre_Tecnico": "Hugo Bribiesca",
      "Telefono": "5551112233",
      "Especialidad": "Diagn\u00f3stico El\u00e9ctrico y Marchas",
      "Email": "hugo.bribiesca@autoelectrico.com",
      "Estado_Activo": "Activo"
    },
    {
      "ID_Tecnico": "TEC-002",
      "Nombre_Tecnico": "Carlos Morales",
      "Telefono": "5554445566",
      "Especialidad": "Alternadores y Sistema de Carga",
      "Email": "carlos.m@autoelectrico.com",
      "Estado_Activo": "Activo"
    },
    {
      "ID_Tecnico": "TEC-003",
      "Nombre_Tecnico": "Alejandro Soto",
      "Telefono": "5557778899",
      "Especialidad": "Cableado, Luces y Accesorios",
      "Email": "alejandro.s@autoelectrico.com",
      "Estado_Activo": "Activo"
    }
  ],
  "Servicios_Catalogo": [
    {
      "ID_Servicio": "SRV-001",
      "Categoria": "Diagn\u00f3stico",
      "Nombre_Servicio": "Diagn\u00f3stico Sistema El\u00e9ctrico",
      "Descripcion": "Escaneo de falla el\u00e9ctrica general, prueba de fuga de corriente y voltaje.",
      "Precio_Sugerido": 350,
      "Tiempo_Estimado_Min": 45,
      "Activo": "S\u00ed"
    },
    {
      "ID_Servicio": "SRV-002",
      "Categoria": "Sistema Carga",
      "Nombre_Servicio": "Mantenimiento de Alternador",
      "Descripcion": "Limpieza, cambio de carbones, placa rectificadora y baleros.",
      "Precio_Sugerido": 850,
      "Tiempo_Estimado_Min": 120,
      "Activo": "S\u00ed"
    },
    {
      "ID_Servicio": "SRV-003",
      "Categoria": "Sistema Arranque",
      "Nombre_Servicio": "Reparaci\u00f3n Motor de Arranque",
      "Descripcion": "Diagn\u00f3stico, cambio de solenoide, carbones y bendix.",
      "Precio_Sugerido": 750,
      "Tiempo_Estimado_Min": 90,
      "Activo": "S\u00ed"
    },
    {
      "ID_Servicio": "SRV-004",
      "Categoria": "Iluminaci\u00f3n",
      "Nombre_Servicio": "Instalaci\u00f3n de Luces / Faros",
      "Descripcion": "Instalaci\u00f3n de cableado, relevadores y cambio de focos principales.",
      "Precio_Sugerido": 400,
      "Tiempo_Estimado_Min": 60,
      "Activo": "S\u00ed"
    },
    {
      "ID_Servicio": "SRV-005",
      "Categoria": "Bater\u00edas",
      "Nombre_Servicio": "Prueba y Cambio de Bater\u00eda",
      "Descripcion": "Diagn\u00f3stico con probador digital CCA, limpieza de bornes y reemplazo.",
      "Precio_Sugerido": 200,
      "Tiempo_Estimado_Min": 30,
      "Activo": "S\u00ed"
    },
    {
      "ID_Servicio": "SRV-006",
      "Categoria": "Accesorios",
      "Nombre_Servicio": "Instalaci\u00f3n de Alarma / Corta Corriente",
      "Descripcion": "Instalaci\u00f3n de relevador corta corriente, sirena y sensor de impacto.",
      "Precio_Sugerido": 950,
      "Tiempo_Estimado_Min": 150,
      "Activo": "S\u00ed"
    },
    {
      "ID_Servicio": "SRV-007",
      "Categoria": "Diagn\u00f3stico",
      "Nombre_Servicio": "Escaneo Computarizado OBD-II",
      "Descripcion": "Lectura y borrado de c\u00f3digos de falla en m\u00f3dulos ECU/BCM.",
      "Precio_Sugerido": 300,
      "Tiempo_Estimado_Min": 30,
      "Activo": "S\u00ed"
    }
  ],
  "Inventario_Refacciones": [
    {
      "ID_Refaccion": "REF-001",
      "Categoria": "Bater\u00edas",
      "Nombre_Pieza": "Bater\u00eda LTH 12V L-47-550",
      "Marca": "LTH",
      "Stock_Actual": 10,
      "Stock_Minimo": 3,
      "Precio_Costo": 1800,
      "Precio_Venta": 2450,
      "Ubicacion_Almacen": "Rack Bater\u00edas",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-002",
      "Categoria": "Alternadores",
      "Nombre_Pieza": "Alternador 90A 12V",
      "Marca": "Bosch",
      "Stock_Actual": 4,
      "Stock_Minimo": 2,
      "Precio_Costo": 2100,
      "Precio_Venta": 2900,
      "Ubicacion_Almacen": "Estante A-1",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-003",
      "Categoria": "Marchas",
      "Nombre_Pieza": "Juego de Carbones para Marcha",
      "Marca": "Duralast",
      "Stock_Actual": 25,
      "Stock_Minimo": 5,
      "Precio_Costo": 80,
      "Precio_Venta": 180,
      "Ubicacion_Almacen": "Gaveta C-3",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-004",
      "Categoria": "Relevadores",
      "Nombre_Pieza": "Relevador 4 Pines 12V 40A",
      "Marca": "Hella",
      "Stock_Actual": 50,
      "Stock_Minimo": 10,
      "Precio_Costo": 35,
      "Precio_Venta": 85,
      "Ubicacion_Almacen": "Gaveta B-1",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-005",
      "Categoria": "Iluminaci\u00f3n",
      "Nombre_Pieza": "Foco LED H4 Par 6000K",
      "Marca": "Philips",
      "Stock_Actual": 15,
      "Stock_Minimo": 4,
      "Precio_Costo": 320,
      "Precio_Venta": 550,
      "Ubicacion_Almacen": "Estante D-2",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-006",
      "Categoria": "Alternadores",
      "Nombre_Pieza": "Regulador de Voltaje 12V",
      "Marca": "Transpo",
      "Stock_Actual": 8,
      "Stock_Minimo": 2,
      "Precio_Costo": 220,
      "Precio_Venta": 420,
      "Ubicacion_Almacen": "Gaveta C-1",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-007",
      "Categoria": "Marchas",
      "Nombre_Pieza": "Solenoide Autom\u00e1tico de Marcha",
      "Marca": "Wai",
      "Stock_Actual": 6,
      "Stock_Minimo": 2,
      "Precio_Costo": 380,
      "Precio_Venta": 680,
      "Ubicacion_Almacen": "Estante A-3",
      "Foto_Pieza": null
    },
    {
      "ID_Refaccion": "REF-008",
      "Categoria": "Fusibles",
      "Nombre_Pieza": "Kit Fusibles Tipo Cuchilla 10-30A",
      "Marca": "Littelfuse",
      "Stock_Actual": 40,
      "Stock_Minimo": 15,
      "Precio_Costo": 45,
      "Precio_Venta": 110,
      "Ubicacion_Almacen": "Gaveta B-4",
      "Foto_Pieza": null
    }
  ],
  "Ordenes_Trabajo": [
    {
      "ID_Orden": "ORD-001",
      "ID_Vehiculo": "VEH-001",
      "ID_Tecnico": "TEC-002",
      "Fecha_Ingreso": "2026-10-06 09:00:00",
      "Fecha_Entrega_Estimada": "2026-10-07 18:00:00",
      "Fecha_Entrega_Real": "2026-10-07 17:30:00",
      "Estado": "Entregado",
      "Prioridad": "Alta",
      "Kilometraje_Ingreso": 85400,
      "Nivel_Combustible": "1/2",
      "Voltaje_Bateria_V": 11.8,
      "Voltaje_Alternador_V": 12.1,
      "Estado_Marcha": "Lento por baja carga",
      "Codigos_Falla_OBD2": "P0562 (Voltaje bajo del sistema)",
      "Falla_Reportada": "El auto no enciende y parpadea el tablero",
      "Diagnostico_Tecnico": "Alternador no carga la bater\u00eda correctamente, carbones desgastados y diodo abierto.",
      "Trabajo_Realizado": "Reemplazo de alternador completo y carga de acumulador.",
      "Total_Mano_Obra": 850,
      "Total_Refacciones": 2900,
      "Subtotal": 3750,
      "Descuento": 0,
      "Total_General": 3750,
      "Anticipo": 1500,
      "Saldo_Pendiente": 0,
      "Metodo_Pago": "Efectivo",
      "Estado_Pago": "Pagado",
      "Foto_Entrada_Frente": null,
      "Foto_Tablero_Testigos": null,
      "Firma_Cliente_Ingreso": null,
      "Firma_Cliente_Entrega": null,
      "Notas_Internas": "Garant\u00eda de 6 meses en alternador."
    },
    {
      "ID_Orden": "ORD-002",
      "ID_Vehiculo": "VEH-002",
      "ID_Tecnico": "TEC-003",
      "Fecha_Ingreso": "2026-10-08 10:30:00",
      "Fecha_Entrega_Estimada": "2026-10-08 17:00:00",
      "Fecha_Entrega_Real": null,
      "Estado": "En Reparaci\u00f3n",
      "Prioridad": "Normal",
      "Kilometraje_Ingreso": 42150,
      "Nivel_Combustible": "3/4",
      "Voltaje_Bateria_V": 12.6,
      "Voltaje_Alternador_V": 14.2,
      "Estado_Marcha": "Normal",
      "Codigos_Falla_OBD2": "Sin c\u00f3digos",
      "Falla_Reportada": "Luces altas no encienden y falseo en lado izquierdo",
      "Diagnostico_Tecnico": "Foco izquierdo quemado y relevador sulfatado por humedad.",
      "Trabajo_Realizado": "Sustituci\u00f3n de juego de focos LED y cambio de relevador.",
      "Total_Mano_Obra": 400,
      "Total_Refacciones": 635,
      "Subtotal": 1035,
      "Descuento": 0,
      "Total_General": 1035,
      "Anticipo": 500,
      "Saldo_Pendiente": 535,
      "Metodo_Pago": "Transferencia",
      "Estado_Pago": "Anticipo Parcial",
      "Foto_Entrada_Frente": null,
      "Foto_Tablero_Testigos": null,
      "Firma_Cliente_Ingreso": null,
      "Firma_Cliente_Entrega": null,
      "Notas_Internas": "Pendiente entrega de arn\u00e9s viejo."
    },
    {
      "ID_Orden": "ORD-003",
      "ID_Vehiculo": "VEH-003",
      "ID_Tecnico": "TEC-001",
      "Fecha_Ingreso": "2026-10-09 11:15:00",
      "Fecha_Entrega_Estimada": "2026-10-10 14:00:00",
      "Fecha_Entrega_Real": null,
      "Estado": "En Diagn\u00f3stico",
      "Prioridad": "Urgente",
      "Kilometraje_Ingreso": 145000,
      "Nivel_Combustible": "1/4",
      "Voltaje_Bateria_V": 10.5,
      "Voltaje_Alternador_V": 0,
      "Estado_Marcha": "No da marcha, hace clic clic",
      "Codigos_Falla_OBD2": "P0615 (Circuito de rel\u00e9 de motor de arranque)",
      "Falla_Reportada": "No da marcha por las ma\u00f1anas, solo hace clic",
      "Diagnostico_Tecnico": "Revisi\u00f3n en proceso de solenoide y voltaje de ca\u00edda en marcha.",
      "Trabajo_Realizado": null,
      "Total_Mano_Obra": 350,
      "Total_Refacciones": 0,
      "Subtotal": 350,
      "Descuento": 0,
      "Total_General": 350,
      "Anticipo": 0,
      "Saldo_Pendiente": 350,
      "Metodo_Pago": "Pendiente",
      "Estado_Pago": "Pendiente",
      "Foto_Entrada_Frente": null,
      "Foto_Tablero_Testigos": null,
      "Firma_Cliente_Ingreso": null,
      "Firma_Cliente_Entrega": null,
      "Notas_Internas": "Cliente espera presupuesto para autorizar."
    }
  ],
  "Detalle_Servicios": [
    {
      "ID_Detalle_Servicio": "DS-001",
      "ID_Orden": "ORD-001",
      "ID_Servicio": "SRV-002",
      "Notas_Servicio": "Desmontaje y reemplazo de alternador",
      "Costo": 850
    },
    {
      "ID_Detalle_Servicio": "DS-002",
      "ID_Orden": "ORD-002",
      "ID_Servicio": "SRV-004",
      "Notas_Servicio": "Alineaci\u00f3n de faros e instalaci\u00f3n de relevador",
      "Costo": 400
    },
    {
      "ID_Detalle_Servicio": "DS-003",
      "ID_Orden": "ORD-003",
      "ID_Servicio": "SRV-001",
      "Notas_Servicio": "Diagn\u00f3stico de marcha y cableado",
      "Costo": 350
    }
  ],
  "Detalle_Refacciones": [
    {
      "ID_Detalle_Refaccion": "DR-001",
      "ID_Orden": "ORD-001",
      "ID_Refaccion": "REF-002",
      "Cantidad": 1,
      "Precio_Unitario": 2900,
      "Subtotal": 2900
    },
    {
      "ID_Detalle_Refaccion": "DR-002",
      "ID_Orden": "ORD-002",
      "ID_Refaccion": "REF-004",
      "Cantidad": 1,
      "Precio_Unitario": 85,
      "Subtotal": 85
    },
    {
      "ID_Detalle_Refaccion": "DR-003",
      "ID_Orden": "ORD-002",
      "ID_Refaccion": "REF-005",
      "Cantidad": 1,
      "Precio_Unitario": 550,
      "Subtotal": 550
    }
  ],
  "Configuracion_Taller": [
    {
      "ID_Config": "CFG-001",
      "Nombre_Taller": "Servicio Autoel\u00e9ctrico Bribiesca",
      "Eslogan": "Expertos en Diagn\u00f3stico El\u00e9ctrico, Alternadores, Marchas y Bater\u00edas",
      "Telefono_Principal": "5551234567",
      "WhatsApp_Notificaciones": "5215551234567",
      "Email_Contacto": "contacto@autoelectricobribiesca.com",
      "Direccion_Taller": "Av. Principal No. 100, Col. Industrial",
      "Horario_Atencion": "Lunes a Viernes 8:00 AM - 6:30 PM | S\u00e1bados 8:00 AM - 2:00 PM",
      "Logo_URL": "logo hugo.jpeg",
      "Terminos_Garantia": "30 d\u00edas de garant\u00eda en mano de obra el\u00e9ctrica. Garant\u00eda de refacciones seg\u00fan fabricante. No cubre manipulaci\u00f3n externa."
    }
  ]
};

if (typeof module !== "undefined") module.exports = INITIAL_DATABASE;
