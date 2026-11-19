import type { Boleto } from "../../../domain/boleto.js";
import type { Cliente } from "../../../domain/cliente.js";
import type { NombrePasarela } from "../../../domain/estados.js";
import type { Orden } from "../../../domain/orden.js";

/** Puertos de salida hacia el almacén de reservas activas y boletas emitidas. */
export interface OrdenRepository {
  guardar(orden: Orden): Promise<void>;
  buscarPorId(id: string): Promise<Orden | null>;
  buscarPorReferenciaPago(pasarela: NombrePasarela, referencia: string): Promise<Orden | null>;
  /** Órdenes pendientes de pago cuyo tiempo de expiración ya pasó. */
  buscarPendientesVencidas(ahora: Date): Promise<Orden[]>;
  /** Asientos que el cliente ya tiene en órdenes pendientes o aprobadas para el evento. */
  contarAsientosActivos(clienteId: string, eventoId: string): Promise<number>;
}

export interface BoletoRepository {
  guardarTodos(boletos: Boleto[]): Promise<void>;
  buscarPorOrden(ordenId: string): Promise<Boleto[]>;
  buscarPorCodigo(codigoRedencion: string): Promise<Boleto | null>;
}

export interface ClienteRepository {
  buscarPorCorreo(correo: string): Promise<Cliente | null>;
  guardar(cliente: Cliente): Promise<void>;
}
