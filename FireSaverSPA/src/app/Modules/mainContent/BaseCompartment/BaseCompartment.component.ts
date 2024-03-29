import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { JsonPipe, Location } from '@angular/common';
import * as L from 'leaflet'
import * as $ from 'jquery';
import { LatLngBoundsLiteral } from 'leaflet';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { FloorDto } from 'src/app/Models/Compartment/floorDto';
import { ToastrService } from 'ngx-toastr';
import { HttpFloorService } from 'src/app/Services/httpFloor.service';
import { HttpEvacuationPlanService } from 'src/app/Services/httpEvacuationPlan.service';
import { HttpEventType } from '@angular/common/http';
import { EvacuationPlanDto } from 'src/app/Models/EvacuationPlan/evacuationPlanDto';
import { ExitPoint, InputRoutePoint, Postion as Position, Postion, RoutePoint, RoutePointType, ScalePointDto } from 'src/app/Models/PointService/pointDtos';
import { MatDialog } from '@angular/material/dialog';
import { PositionInputDialogComponent } from '../position-input-dialog/position-input-dialog.component';
import { HttpPointService } from 'src/app/Services/httpPoint.service';
import { ConfirmDialogComponent } from '../../../Components/ConfirmDialog/confirm-dialog.component';
import { CompartmentDto } from 'src/app/Models/Compartment/compartmentDto';
import { QrCodeDialogComponent } from '../qr-code-dialog/qr-code-dialog.component';
import { TestInput } from 'src/app/Models/TestModels/testInput';
import { TestDialogComponent } from '../../../Modules/mainContent/test-dialog/test-dialog.component';
import { HttpTestService } from 'src/app/Services/httpTest.service';
import { HttpIotService } from 'src/app/Services/httpIot.service';
import { AddIotDialogComponent } from '../add-iot-dialog/add-iot-dialog.component';
import { QRCodeFormat } from 'src/app/Models/QRCodeFormat/QRCodeFormat';

enum MapType {
  ScalePoints,
  ExitPoints,
  Iots,
  Shelters
}

export interface InitCallback {
  (): void;
}

@Component({ template: '' })
export abstract class BaseCompartmentComponent<T extends CompartmentDto> implements OnInit, AfterViewInit {

  private mapType: MapType = MapType.ScalePoints;

  @ViewChildren("card") private cards: QueryList<ElementRef>

  private map: any;
  private bounds: LatLngBoundsLiteral;

  protected compartmentId: number;

  compartmentInfo: T;
  evacPlanInfo: EvacuationPlanDto;

  get testInfo(): TestInput {
    return this.compartmentInfo?.compartmentTest
  }

  uploadingValue: number = 0;

  selectedMapPosition: Position;
  private currentMarker: L.Marker;

  private selectedPointOnMap: L.CircleMarker;

  private pointBaseColor: string = "#ff7800";
  private pointeSelectedColor: string = "#ff0000";
  private userPointColor: string = "#4000ff";

  scalePointMarkers = new Map();
  exitPoints: ExitPoint[] = [];
  private exitPointMarkers = new Map();
  private routePolylines = new Map();
  private selectedRoutePoint: ExitPoint;

  private iotPos = new Map<string, L.CircleMarker>();

  private userMarker = new Map<number, L.CircleMarker>();

  constructor(protected location: Location,
    protected activatedRoute: ActivatedRoute,
    protected toastrService: ToastrService,
    protected evacuationService: HttpEvacuationPlanService,
    protected matDialog: MatDialog,
    protected pointService: HttpPointService,
    protected testService: HttpTestService,
    protected iotService: HttpIotService) { }

  ngAfterViewInit(): void {
    this.initExpandableList();
  }

  centerMap() {
    if (this.map) {
      this.map.fitBounds(this.bounds);
    }
  }

  expandList(element) {
    console.log(element)
    const elem = element.nativeElement.querySelector('.collapse')
    if (elem?.classList.contains('show')) {
      elem?.classList.remove('show')
    } else {
      elem?.classList.add('show')
    }
  }

  abstract isCompartmentFloor();

  ngOnInit() {


    this.activatedRoute.params.subscribe((params: Params) => {
      this.compartmentId = params.Id

      if (this.compartmentId) {
        this.initCompartmentInfo(() => { this.initUserPostions(); });
        this.initEvacuationPlanInfo();
      } else {
        this.toastrService.error($localize`Unknown compartment id`)
      }
    })
  }

  backBtnClick() {
    this.location.back();
  }

  uploadFile = (files) => {
    if (files.length === 0) {
      return;
    }
    let fileToUpload = <File>files[0];
    const formData = new FormData();
    formData.append('evacPlanImgae', fileToUpload, fileToUpload.name);

    this.evacuationService.uploadEvacuationPlan(formData, this.compartmentId).subscribe(
      event => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadingValue = Math.round(100 * event.loaded / event.total);
        }
        else if (event.type === HttpEventType.Response) {
          this.toastrService.success($localize`Plan is uploaded`)
          this.evacPlanInfo = event.body;
          this.uploadingValue = 0;
          this.initMap();
        }
      },
      error => {
        this.uploadingValue = 0;
        this.toastrService.error($localize`:@@ErrorToastr:Something went wrong! Try again`)
      }
    )
  }

  displayRoutePoints() {
    this.mapType = MapType.ExitPoints;
    this.initMapPoints();
  }

  displayScalePoints() {
    this.mapType = MapType.ScalePoints;
    this.initMapPoints();
  }

  displayIots() {
    this.mapType = MapType.Iots;
    this.initMapPoints();
  }

  displayShelters() {
    this.mapType = MapType.Shelters;
    this.initMapPoints();
  }

  protected abstract initCompartmentInfo(callback: InitCallback): void;
  abstract updateCOmpartmentInfo();
  abstract canChangeCompartment(): boolean

  private initExpandableList() {
    this.cards.forEach((card: ElementRef) => {
      card.nativeElement.addEventListener('click', (e) => {
        const elem = card.nativeElement.parentNode.querySelector('.collapse')
        if (elem?.classList.contains('show')) {
          elem?.classList.remove('show')
        } else {
          elem?.classList.add('show')
        }
      })
    })
  }


  private initEvacuationPlanInfo() {
    if (this.compartmentId) {
      this.evacuationService.getEvacuationPlanOfCompartment(this.compartmentId).subscribe(response => {
        this.evacPlanInfo = response;
        this.initMap();
        this.initMapPoints();

      }, error => {
        this.toastrService.error($localize`Can't get evacuation plan info`)
      })
    }
  }

  getUserPostion() {
    this.initCompartmentInfo(() => {
      this.initUserPostions();
    });

  }

  private initUserPostions() {
    this.clearUserMarkers();
    if (this.compartmentInfo.inboundUsers && this.compartmentInfo.inboundUsers.length > 0) {
      this.compartmentInfo.inboundUsers.forEach(user => {
        if (user.lastSeenBuildingPosition) {
          this.pointService.TransformUserWorldPostion(this.compartmentId, user.lastSeenBuildingPosition).subscribe(transformedPos => {
            const convertedUserWorldPosToMapPos = transformedPos;
            const userMarker = this.placeMarker(convertedUserWorldPosToMapPos.latitude,
              convertedUserWorldPosToMapPos.longtitude,
              this.userPointColor);
            userMarker.bindPopup(`${user.name} ${user.surname} ${user.telephoneNumber}`)
            this.userMarker.set(user.id, userMarker);
          });
        }
      });
    }
  }

  private clearUserMarkers() {
    if (this.userMarker.size > 0) {
      this.userMarker.forEach((value, key) => {
        this.map.removeLayer(value);
      })
    }
  }

  private initMap() {
    if (this.evacPlanInfo) {

      this.bounds = [[0, 0], [this.evacPlanInfo.height, this.evacPlanInfo.width]];
      
      const newSrc = L.extend({}, L.CRS.Simple, {
       // projection: L.Projection.LonLat,
        // transformation: new L.Transformation(1, 0, 1, 0), // this line is changed!!
        
      });

      this.map = L.map('myMap', {
        crs: L.CRS.Simple,
        maxZoom: 5,
        minZoom: -2,
      });
      var image = L.imageOverlay(this.evacPlanInfo.url, this.bounds).addTo(this.map);

      setTimeout(() => {
        this.centerMap()
      }, 1000)

      var icon = L.icon({
        iconUrl: 'assets/images/marker-icon.png',
        shadowUrl: 'assets/images/marker-shadow.png',
        iconAnchor: [10, 40],
      });

      this.map.on('click', (e) => {
        const pos = e.latlng;

        this.selectedMapPosition = {
          latitude: pos.lat,
          longtitude: pos.lng
        }

        if (this.currentMarker) {
          this.currentMarker.setLatLng(e.latlng);
        } else {
          this.currentMarker = L.marker(e.latlng, { icon }).addTo(this.map);
        }
      })
    }
  }

  private initMapPoints() {
    if (this.mapType == MapType.ScalePoints) {
      this.clearIotsMarkers()
      this.clearRoute()
      this.initScalePointMarkers();
    } else if (this.mapType == MapType.ExitPoints) {
      this.clearIotsMarkers()
      this.clearScalePoints()
      this.initExitPointMarkers();
    }
    else if (this.mapType == MapType.Iots) {
      this.clearRoute()
      this.clearScalePoints();
      this.initIotMarkers();
    }
  }

  initScalePointMarkers() {
    const currentScalePoints = this.evacPlanInfo?.scaleModel?.scalePoints;
    this.clearScalePoints()
    if (currentScalePoints) {
      currentScalePoints.forEach(scalePoint => {
        this.scalePointMarkers.set(scalePoint.id, this.placeMarker(scalePoint.mapPosition.latitude,
          scalePoint.mapPosition.longtitude,
          this.pointBaseColor));
      });
    }
  }

  initExitPointMarkers() {
    this.clearRoute();
    this.pointService.getExitPoints(this.compartmentId).subscribe(response => {
      this.exitPoints = response;
      this.exitPoints.forEach((p: ExitPoint) => {
        this.exitPointMarkers.set(p.id, this.placeMarker(p.mapPosition.latitude, p.mapPosition.longtitude,
          this.pointBaseColor));
      })

    });
  }


  clearScalePoints() {
    if (this.scalePointMarkers) {
      this.scalePointMarkers.forEach((value, key, map) => {
        var pointMarker = value;
        this.map.removeLayer(pointMarker);
      });
    }
  }

  addScalePoint() {
    let dialogRef = this.matDialog.open(PositionInputDialogComponent);
    dialogRef.afterClosed().subscribe(data => {
      if (data) {
        const sendData: ScalePointDto = {
          id: 0,
          mapPosition: this.selectedMapPosition,
          worldPosition: data
        };

        this.pointService.addScalePoint(sendData, this.evacPlanInfo.id).subscribe(response => {

          const newScalePointMarker = this.placeMarker(this.selectedMapPosition.latitude,
            this.selectedMapPosition.longtitude,
            this.pointBaseColor)
          this.scalePointMarkers.set(response.id, newScalePointMarker)
        })
      }
    })
  }

  removeScalePointMarker(pointId: number) {

    var dilaogRef = this.matDialog.open(ConfirmDialogComponent, {
      data: { message: $localize`Are you sure you want to delete scale point with id: ${pointId}` }
    })

    dilaogRef.afterClosed().subscribe(data => {
      if (data == true) {
        this.pointService.removeScalePoint(pointId).subscribe(success => {
          const marker = this.scalePointMarkers.get(pointId);

          if (marker == this.selectedPointOnMap) {
            this.selectedPointOnMap = null;
          }

          this.map.removeLayer(marker);
          this.toastrService.success($localize`Scale point with id: ${pointId} deleted`);
          this.scalePointMarkers.delete(pointId);

        }, error => {

          if (error.error?.message) {
            this.toastrService.warning(error.error?.message);

            const marker = this.scalePointMarkers.get(pointId);

            if (marker == this.selectedPointOnMap) {
              this.selectedPointOnMap = null;
            }

            this.map.removeLayer(marker);
            this.scalePointMarkers.delete(pointId);

          } else {
            this.toastrService.error($localize`:@@ErrorToastr:Something went wrong. Try again`);
          }

        })
      }
    })
  }

  selectScalePoint(scalePointId: number) {
    const newlySelectedPoint = this.scalePointMarkers.get(scalePointId);
    this.selectPoint(newlySelectedPoint);
  }

  selectPoint(marker: L.CircleMarker) {

    if (this.selectedPointOnMap) {
      this.selectedPointOnMap.setStyle({ fillColor: this.pointBaseColor })
      this.selectedPointOnMap = marker;
      this.selectedPointOnMap.setStyle({ fillColor: this.pointeSelectedColor })
    } else {
      this.selectedPointOnMap = marker;
      this.selectedPointOnMap.setStyle({ fillColor: this.pointeSelectedColor })
    }
  }

  placeMarker(lat, lng, color): L.CircleMarker {
    const newRoutePoint: L.CircleMarker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: color,
      color: color,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(this.map);
    return newRoutePoint;
  }

  clearRoute() {
    this.exitPoints.forEach(routePoint => {

      const marker = this.exitPointMarkers.get(routePoint.id);
      const polyline = this.routePolylines.get(routePoint.id);

      if (marker)
        this.map.removeLayer(marker);

      if (polyline)
        this.map.removeLayer(polyline);
    });

    this.exitPointMarkers.clear();
    this.routePolylines.clear();
    this.exitPoints = [];

  }

  getCompartmentQrCode() {
    const dialogRef = this.matDialog.open(QrCodeDialogComponent, {
      data: { info: JSON.stringify({ compatrmentId: this.compartmentId } as QRCodeFormat) }
    })
  }

  selectExitPoint(routePointId: number): L.CircleMarker {
    console.log(this.exitPointMarkers)
    const newlySelectedPoint = this.exitPointMarkers.get(routePointId);
    this.selectedRoutePoint = this.exitPoints.find(elem => elem.id == routePointId);
    this.selectPoint(newlySelectedPoint);
    console.log(this.selectedRoutePoint, " - current route point")
    return newlySelectedPoint
  }

  addExitPoint() {
    if (this.selectedMapPosition) {
      this.pointService.addExitPoint(this.compartmentId, this.selectedMapPosition).
        subscribe(response => {
          this.initMapPoints();
        })
    }
  }

  removeExitPoint(routePointId: number) {
    this.pointService.deleteExitPoint(routePointId).subscribe(response => {
      this.initExitPointMarkers();
    })
  }

  addTest() {
    const dialogRef = this.matDialog.open(TestDialogComponent)
    dialogRef.afterClosed().subscribe((data: TestInput) => {
      if (data) {
        this.testService.addTestToCompartment(this.compartmentId, data).subscribe(success => {
          this.compartmentInfo.compartmentTest = success
          this.toastrService.success($localize`Test is added to compartment`)
        }, error => {
          this.toastrService.success($localize`:@@ErrorToastr:Something went wrong! Try again`)
        });
      }
    })
  }

  updateTest() {
    const dialogRef = this.matDialog.open(TestDialogComponent, {
      data: this.compartmentInfo.compartmentTest
    })
    dialogRef.afterClosed().subscribe((data: TestInput) => {
      if (data) {
        this.testService.updateCompartmentTest(this.compartmentInfo.id, data).subscribe(success => {
          this.compartmentInfo.compartmentTest = success
          this.toastrService.success($localize`Test is successfully updated`)
        })
      }
    })
  }

  deleteTest() {
    const dialogRef = this.matDialog.open(ConfirmDialogComponent, {
      data: { message: $localize`Are you sure you wnat to delete test for compartment with id: ${this.compartmentId}` }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (data) {
        this.testService.deleteTestFromCompartment(this.compartmentId).subscribe(success => {
          this.compartmentInfo.compartmentTest = null
          this.toastrService.success($localize`Test removed successfully`)
        }, error => {
          this.toastrService.error($localize`:@@ErrorToastr:Something went wrong! Try again`)
        });
      }
    })
  }

  clearIotsMarkers() {
    this.compartmentInfo?.ioTs.forEach(iot => {
      var iotMarker = this.iotPos.get(iot.iotIdentifier);
      if (iotMarker)
        this.map.removeLayer(iotMarker);
    })
  }

  initIotMarkers() {
    console.log("initing iot Points")
    this.clearIotsMarkers()
    var iots = this.compartmentInfo.ioTs;
    console.log(iots)
    iots.forEach(iot => {
      const iotMarker = this.placeMarker(iot.mapPosition.latitude, iot.mapPosition.longtitude, this.pointBaseColor);
      this.iotPos.set(iot.iotIdentifier, iotMarker);
    })
  }

  addIotToCompartment() {
    const dialogRef = this.matDialog.open(AddIotDialogComponent);
    dialogRef.afterClosed().subscribe(data => {
      if (data) {
        const identifier = data.iotIdField;
        const iotPos = this.selectedMapPosition;
        this.iotService.addIotToCompartment(this.compartmentId, identifier).subscribe(success => {
          this.iotService.updateIotPos(identifier, iotPos).subscribe(data => {
            this.toastrService.success($localize`New iot is added`);
            this.initCompartmentInfo(() => {
              this.displayIots();
            });

          })
        })
      }
    })
  }

  selectIotMarker(iotIdentifier: string) {
    const iotMarker = this.iotPos.get(iotIdentifier);
    if (iotMarker) {
      this.selectPoint(iotMarker);
    }
  }

  removeIotFromCompartment(identifier: string) {
    var iot = this.compartmentInfo.ioTs.find(iot => iot.iotIdentifier == identifier);
    if (iot) {
      this.iotService.removeIotFromCompartment(this.compartmentId, iot.iotIdentifier).subscribe(data => {
        const iotMarker = this.iotPos.get(iot.iotIdentifier);
        this.map.removeLayer(iotMarker);
        this.toastrService.success($localize`Iot is removed`)
        this.initCompartmentInfo(() => { });
      }, error => {
        this.toastrService.error($localize`:@@ErrorToastr:Something went wrong! Try again`);
      })
    }
  }

  printQrCode(identifier: number) {
    const dialofRef = this.matDialog.open(QrCodeDialogComponent, {
      data: { info: JSON.stringify({ compatrmentId: this.compartmentId, IOTId: identifier } as QRCodeFormat) }
    })
  }

  IsRoutePointExit(routeType: RoutePointType) {
    if (routeType == RoutePointType.EXIT)
      return true;
    else
      return false;
  }

}
