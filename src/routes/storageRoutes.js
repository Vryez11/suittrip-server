/**
 * 보관함 라우트
 * Phase 3 - 보관함 CRUD API 엔드포인트
 */

import express from 'express';
import {
  getStorages,
  getStorage,
  createStorage,
  updateStorage,
  deleteStorage,
} from '../controllers/storageController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 모든 보관함 라우트에 인증 미들웨어 적용
router.use(authenticate);

/**
 * 보관함 목록 조회
 * GET /api/storages
 * Query params: status, type, page, limit
 */
router.get('/', getStorages);

/**
 * 보관함 단일 조회
 * GET /api/storages/:id
 */
router.get('/:id', getStorage);

/**
 * 보관함 생성
 * POST /api/storages
 */
router.post('/', createStorage);

/**
 * 보관함 수정
 * PUT /api/storages/:id
 */
router.put('/:id', updateStorage);

/**
 * 보관함 삭제
 * DELETE /api/storages/:id
 */
router.delete('/:id', deleteStorage);

export default router;
