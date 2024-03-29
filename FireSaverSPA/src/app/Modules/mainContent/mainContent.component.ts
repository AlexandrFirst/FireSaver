import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BaseHttpService } from 'src/app/Services/baseHttp.service';
import { HttpBuildingService } from 'src/app/Services/httpBuilding.service';
import { HttpIotService } from 'src/app/Services/httpIot.service';
import { SignalRServiceService } from 'src/app/Services/SignalRService.service';
import { AddIotDialogComponent } from './add-iot-dialog/add-iot-dialog.component';
import { ResponsibleUserAddDialogComponent } from './responsible-user-add-dialog/responsible-user-add-dialog.component';

@Component({
  selector: 'app-mainContent',
  templateUrl: './mainContent-header.component.html',
  styleUrls: ['./mainContent.component.scss']
})
export class MainContentComponent implements OnInit {

  buildingLink: string = '/main'

  isAdmin: boolean = false;
  isAuthUser: boolean = false;
  isGuest: boolean = false;
  isAlarmOn: boolean = false;

  reponsibleBuilding: number = null;

  constructor(private httpBaseService: BaseHttpService,
    private iotService: HttpIotService,
    private buildingService: HttpBuildingService,
    private matDialog: MatDialog,
    private toastr: ToastrService,
    private router: Router,
    private signalRService: SignalRServiceService) { }

  ngOnInit() {
    var authData = this.httpBaseService.readAuthResponse();
    if (authData.roles.indexOf('Admin') >= 0) {
      this.buildingLink = this.buildingLink.concat('/buildings');
      this.isAdmin = true;

    } else if (authData.roles.indexOf('AuthorizedUser') >= 0) {
      const respBuildId = authData.responsibleBuildingId;
      this.isAuthUser = true;
      if (respBuildId != -1) {
        this.reponsibleBuilding = respBuildId;
        this.buildingLink = this.buildingLink.concat('/buildings/' + this.reponsibleBuilding);
      }
    } else {
      this.isGuest = true;
    }

    this.signalRService.connectToHub();

    if (this.signalRService.IsConnected) {
      console.log("Connected to service")
      this.signalRService.getAlarm().subscribe(data => {
        console.log("in component alaram")
        this.isAlarmOn = true;
      })

      this.signalRService.AlarmOff().subscribe(data => {
        this.isAlarmOn = false;
      })
    }
  }

  swithOffAlarm() {
    if (this.isAlarmOn == true) {
      this.signalRService.switchOffAlaram().subscribe(response => {
        this.isAlarmOn = false;
      })
    }
  }

  switchOnAlaram() {
    if (this.isAlarmOn == false) {
      this.signalRService.setAlaram().subscribe(response => {
        this.isAlarmOn = true;
      })
    }
  }

  addIotToDb() {
    const dialofRef = this.matDialog.open(AddIotDialogComponent)
    dialofRef.afterClosed().subscribe(data => {
      if (data) {
        this.iotService.addIotToDb(data.iotIdField).subscribe(success => {
          this.toastr.success("Iot is added to db");
        }, error => {
          this.toastr.success("Try again");
        })
      }
    })
  }

  changeToUkraine() {
    const currentUrl = this.router.url;
    window.location.href = 'https://localhost:4201' + currentUrl
  }

  changeToEnglish() {
    const currentUrl = this.router.url;
    window.location.href = 'https://localhost:4200' + currentUrl
  }

  addResponsibleUserToBuilding() {
    var authData = this.httpBaseService.readAuthResponse();
    const dialofRef = this.matDialog.open(ResponsibleUserAddDialogComponent)
    dialofRef.afterClosed().subscribe(data => {
      if (data) {
        this.buildingService.setResponsibleUserForBuilding(authData.responsibleBuildingId, data.mail).subscribe(success => {
          this.toastr.success("Responsible user added is added to db");
        }, error => {
          this.toastr.success("Try again");
        })
      }
    })
  }
}
