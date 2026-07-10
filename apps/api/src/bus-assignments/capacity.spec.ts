import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import {
  assertBusHasAvailableSeat,
  assertCapacityCanFitOccupancy,
  deriveBusAvailability,
} from "./capacity.js";

assert.deepEqual(deriveBusAvailability(40, 0), {
  capacity: 40,
  occupiedSeats: 0,
  availableSeats: 40,
  isFull: false,
});

assert.deepEqual(deriveBusAvailability(40, 40), {
  capacity: 40,
  occupiedSeats: 40,
  availableSeats: 0,
  isFull: true,
});

assert.doesNotThrow(() => assertBusHasAvailableSeat(40, 39));
assert.throws(() => assertBusHasAvailableSeat(40, 40), ConflictException);

assert.doesNotThrow(() => assertCapacityCanFitOccupancy(35, 35));
assert.throws(
  () => assertCapacityCanFitOccupancy(34, 35),
  ConflictException,
);
