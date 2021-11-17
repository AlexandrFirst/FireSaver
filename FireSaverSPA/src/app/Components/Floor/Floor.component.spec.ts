/* tslint:disable:no-unused-variable */
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

import { FloorComponent } from './Floor.component';

describe('FloorComponent', () => {
  let component: FloorComponent;
  let fixture: ComponentFixture<FloorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FloorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FloorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
