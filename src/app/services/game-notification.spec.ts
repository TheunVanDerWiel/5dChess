import { TestBed } from '@angular/core/testing';

import { GameNotification } from './game-notification';

describe('GameNotification', () => {
  let service: GameNotification;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameNotification);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
