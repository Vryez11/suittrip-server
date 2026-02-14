/**
 * 랜딩 공개 API - 파트너 등록 신청
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { success, error } from '../utils/response.js';

const toJson = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
};

/**
 * 파트너 등록 신청
 * POST /api/t/store-registrations
 */
export const createStoreRegistration = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      zonecode,
      address,
      detailAddress,
      nearStation,
      latitude,
      longitude,
      directions,
      phoneNumber,
      ownerName,
      ownerEmail,
      ownerPhone,
      operatingHours,
      couponEnabled,
      luggageOptions,
      amenities,
      parking,
      menuItems,
      mainImage,
      logo,
      menuImages,
      storeInfo,
    } = req.body || {};

    const errors = [];
    if (!name) errors.push('매장 이름을 입력해주세요.');
    if (!category) errors.push('카테고리를 입력해주세요.');
    if (!address) errors.push('주소를 입력해주세요.');
    if (!phoneNumber) errors.push('매장 전화번호를 입력해주세요.');
    if (!ownerName) errors.push('대표자 이름을 입력해주세요.');
    if (!ownerEmail) errors.push('대표자 이메일을 입력해주세요.');
    if (!ownerPhone) errors.push('대표자 전화번호를 입력해주세요.');

    if (errors.length > 0) {
      return res.status(400).json(
        error('VALIDATION_ERROR', '입력 정보를 확인해주세요.', { errors })
      );
    }

    const registrationId = `reg_${uuidv4()}`;
    const storeId = `store_${uuidv4()}`;

    await query(
      `INSERT INTO store_registrations (
        id, store_id,
        name, category, description,
        zonecode, address, detail_address, near_station, latitude, longitude, directions,
        phone_number, owner_name, owner_email, owner_phone,
        operating_hours, coupon_enabled, luggage_options, amenities, parking, menu_items,
        main_image, logo, menu_images, store_info,
        status, created_at, updated_at
      ) VALUES (
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        'pending', NOW(), NOW()
      )`,
      [
        registrationId,
        storeId,
        name,
        category,
        description || null,
        zonecode || null,
        address,
        detailAddress || null,
        nearStation || null,
        latitude ?? null,
        longitude ?? null,
        directions || null,
        phoneNumber,
        ownerName,
        ownerEmail,
        ownerPhone,
        toJson(operatingHours),
        couponEnabled ? 1 : 0,
        toJson(luggageOptions),
        toJson(amenities),
        toJson(parking),
        toJson(menuItems),
        mainImage || null,
        logo || null,
        toJson(menuImages),
        toJson(storeInfo),
      ]
    );

    return res.status(200).json(
      success(
        {
          storeId,
          registrationId,
        },
        '파트너 등록 신청이 완료되었습니다.'
      )
    );
  } catch (err) {
    console.error('파트너 등록 신청 오류:', err);
    return res.status(500).json(
      error('INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다.', {
        message: err.message,
      })
    );
  }
};
