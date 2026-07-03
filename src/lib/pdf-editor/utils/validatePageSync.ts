/**
 * Validation utilities for PDF editor page synchronization
 * Helps detect and debug race conditions where annotations might be saved to wrong pages
 */

import { toast, TOAST_SUCCESS, TOAST_WARNING } from './toast';


export interface PageSyncValidation {
	isValid: boolean;
	warning?: string;
	details?: {
		currentPage: number;
		internalPage?: number;
		expectedPage?: number;
	};
}

/**
 * Validates that page numbers are in sync before save operations
 * Logs warnings when mismatches are detected
 *
 * @param currentPage - The logical current page number
 * @param internalPage - The visual current page number (optional)
 * @param operation - Description of the operation being performed
 * @returns Validation result with warning if mismatch detected
 */
export function validatePageSync(
	currentPage: number,
	internalPage?: number,
	operation: string = 'save'
): PageSyncValidation {
	// If internalPage is provided, check for mismatch
	if (internalPage !== undefined && currentPage !== internalPage) {
		const warning = `⚠️ Page sync warning during ${operation}: currentPage=${currentPage}, internalPage=${internalPage}`;
		toast.push(warning, { theme: TOAST_WARNING });

		return {
			isValid: false,
			warning,
			details: {
				currentPage,
				internalPage
			}
		};
	}

	return {
		isValid: true
	};
}

/**
 * Validates that annotations are being saved to the expected page
 * Useful for debugging when annotations appear on wrong pages
 *
 * @param pageToSave - The page number where annotations will be saved
 * @param expectedPage - The page number where annotations should be saved
 * @param annotationCount - Number of annotations being saved
 * @returns Validation result with warning if mismatch detected
 */
export function validateAnnotationSave(
	pageToSave: number,
	expectedPage: number,
	annotationCount: number
): PageSyncValidation {
	if (pageToSave !== expectedPage) {
		const warning = `⚠️ Annotation save mismatch: saving ${annotationCount} annotations to page ${pageToSave} but expected page ${expectedPage}`;
		toast.push(warning, { theme: TOAST_WARNING });

		return {
			isValid: false,
			warning,
			details: {
				currentPage: pageToSave,
				expectedPage
			}
		};
	}

	toast.push(`Page sync OK: Saving ${annotationCount} annotations to page ${pageToSave}`, {
		theme: TOAST_SUCCESS
	});

	return {
		isValid: true
	};
}

/**
 * Logs detailed page transition information for debugging
 * Helps trace the sequence of page changes and save operations
 *
 * @param fromPage - Page number being navigated away from
 * @param toPage - Page number being navigated to
 * @param hasUnsavedChanges - Whether there are unsaved changes on the old page
 */
export function logPageTransition(
	fromPage: number,
	toPage: number,
	hasUnsavedChanges: boolean = false
): void {
	const changeStatus = hasUnsavedChanges ? '(with unsaved changes)' : '(clean)';
	toast.push(
		`Page transition: ${fromPage} -> ${toPage} ${changeStatus}\nTimestamp: ${new Date().toISOString()}`
	);
}


