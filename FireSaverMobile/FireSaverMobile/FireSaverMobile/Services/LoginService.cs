﻿using FireSaverMobile.Contracts;
using FireSaverMobile.Helpers;
using FireSaverMobile.Models;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace FireSaverMobile.Services
{
    public class LoginService : BaseHttpService, ILoginService
    {
        
        public async Task<AuthentificationResponse> AuthUser(AuthentificationInput authInput)
        {
            var userLoginInput = authInput;
            HttpResponseMessage response = await userLoginInput.PostRequest(client, $"http://{serverAddr}/User/auth");
            var authResponse = await transformHttpResponse<AuthentificationResponse>(response);

            await writeAuthValues(authResponse);

            return authResponse;
        }

        public async Task<AuthentificationResponse> AuthGuest()
        {
            AuthentificationResponse response = await client.GetRequest<AuthentificationResponse>($"http://{serverAddr}/User/guestAuth");
            await writeAuthValues(response);
            return response;
        }

        public async Task<AuthentificationResponse> ReadDataFromStorage()
        {
            return await retrieveAuthValues();
        }

        public async Task<bool> CheckTokenValidity()
        {
            ServerResponse response = await client.GetRequest<ServerResponse>($"http://{serverAddr}/User/tokenValid");
            if (response == null)
                return false;
            return true;
        }

        public void ClearStorage()
        {
            deleteAuthValues();
        }

        public LoginService():base()
        {

        }
    }
}
