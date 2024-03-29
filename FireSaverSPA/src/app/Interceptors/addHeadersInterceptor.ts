import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { Observable } from "rxjs";

export class AddHeaderInterceptor implements HttpInterceptor {
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const bearerToken = localStorage.getItem('token');
        console.log(req);
        if (bearerToken) {
            const clonedRequest = req.clone({ 
                headers: req.headers.append('Authorization', 'Bearer ' + bearerToken) 
            });
            return next.handle(clonedRequest);
        }
        else {
            return next.handle(req);
        }
    }
}