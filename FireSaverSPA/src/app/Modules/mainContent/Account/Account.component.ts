import { DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { UserInfoDto } from 'src/app/Models/UserService/userInfoDto';
import { HttpUserService } from 'src/app/Services/httpUser.service';
import { ConfirmDialogComponent } from '../../../Components/ConfirmDialog/confirm-dialog.component';

@Component({
  selector: 'app-Account',
  templateUrl: './Account.component.html',
  styleUrls: ['./Account.component.scss']
})
export class AccountComponent implements OnInit {

  private userId: number;
  public userrInfo: UserInfoDto = new UserInfoDto();

  updateUserInfoForm: FormGroup;

  get updatePhoneNumber() {
    return this.updateUserInfoForm.get('telNumber');
  }

  constructor(private userService: HttpUserService,
    private toastrService: ToastrService,
    public datepipe: DatePipe,
    private router: Router,
    private dialog: MatDialog) { }

  ngOnInit() {
    const authResponse = this.userService.readAuthResponse();
    this.userId = authResponse.userId;

    const localizedTelNumber: string = "(^\\d{10,})|(^\\+?3?8?(0[\\s\\.-]\\d{2}[\\s\\.-]\\d{3}[\\s\\.-]\\d{2}[\\s\\.-]\\d{2})$)"

    this.updateUserInfoForm = new FormGroup({
      name: new FormControl(this.userrInfo?.name, [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30)
      ]),
      surname: new FormControl(this.userrInfo?.surname, [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30)
      ]),
      patronymic: new FormControl(this.userrInfo?.patronymic, [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30)
      ]),
      telNumber: new FormControl(this.userrInfo?.telephoneNumber, [
        Validators.required,
        Validators.pattern(localizedTelNumber)
      ]),
      dob: new FormControl(this.userrInfo?.dob, [
        Validators.required
      ])
    });

    this.initUserInfo();
  }

  updateUserInfo() {
    console.log(this.updateUserInfoForm.value)
    if (this.updateUserInfoForm.invalid) {
      this.toastrService.error($localize`Wrong from data. All fields are must`)
    }
    else {
      this.userService.UpdateUserInfo(this.userrInfo).subscribe(success => {
        this.userrInfo = success;
        this.toastrService.success($localize`Your data is updated`)
      }, error => {
        this.toastrService.error($localize`Something went wrong. Try again`);
      })
    }
  }

  cancelUpdating() {
    let dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: $localize`Are you shure you want to cancel editing?` }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (data == true) {
        this.initUserInfo();
      }
    });
  }

  logoutUser() {
    let dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { message: $localize`Are you shure you want to logout?` }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (data == true) {
        this.initUserInfo();
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (data == true) {
        this.userService.deleteStorage();
        this.router.navigate(['/'])
      }
    });
  }

  private initUserInfo() {
    this.userService.GetUserInfoById(this.userId).subscribe(info => {
      this.userrInfo = info
      console.log(this.userrInfo)
    }, error => {
      this.toastrService.error($localize`Troubles while loading user info`)
    });
  }



}
