import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class UserService {
	private url = environment.apiBaseUrl + 'users';

	private http = inject(HttpClient);

	create(): Observable<string> {
		return this.http.post<string>(this.url, {});
	}
}
