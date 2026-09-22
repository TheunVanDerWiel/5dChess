import { Directive, HostListener, Input } from '@angular/core';

/** Opens WhatsApp with the given text ready to send, on a click of the host element. */
@Directive({
	selector: '[appShareOnWhatsapp]'
})
export class ShareOnWhatsapp {
	@Input({ required: true }) text!: string;

	@HostListener('click') onClick() {
		if (!this.text) { return; }
		window.open('https://wa.me/?text=' + encodeURIComponent(this.text), '_blank');
	}
}
