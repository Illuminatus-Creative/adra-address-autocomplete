/**
 * Where bin/e2e-env.sh builds the test site. Keep in step with E2E_DIR there.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const siteDir =
	process.env.E2E_DIR ?? join(tmpdir(), 'adra-address-autocomplete-e2e');
