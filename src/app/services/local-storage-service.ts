import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class LocalStorageService {
	setItem(key: string, value: any): void {
		try {
			const jsonValue = JSON.stringify(value);
			localStorage.setItem(key, jsonValue);
		} catch (error) {
			console.error('Error saving to local storage', error);
		}
	}
	
	getItem(key: string): any {
		try {
			const value = localStorage.getItem(key);
			return JSON.parse(value || "null");
		} catch (error) {
			console.error('Error saving to local storage', error);
		}
		return null;
	}
}
