import { ConflictException } from "@nestjs/common";

export function deriveBusAvailability(capacity: number, occupiedSeats: number) {
  return {
    capacity,
    occupiedSeats,
    availableSeats: capacity - occupiedSeats,
    isFull: occupiedSeats >= capacity,
  };
}

export function assertBusHasAvailableSeat(capacity: number, occupiedSeats: number) {
  if (occupiedSeats >= capacity) {
    throw new ConflictException("Onibus sem vagas disponiveis");
  }
}

export function assertCapacityCanFitOccupancy(
  capacity: number,
  occupiedSeats: number,
) {
  if (capacity < occupiedSeats) {
    throw new ConflictException(
      "Capacidade nao pode ser menor que a ocupacao ativa",
    );
  }
}
