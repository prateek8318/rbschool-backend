import axios from 'axios';
import { env } from '../config/env';

// Simple API Error class
class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

// Simple API Response class
class ApiResponse {
  static success(res: any, statusCode: number, data: any, message: string) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }
}

// Simple async handler
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const getDashboardStats = asyncHandler(async (req, res) => {
  const { schoolId } = (req as any).user;

  try {
    // Get schools count
    const schoolsResponse = await axios.get(`${env.SCHOOL_SERVICE_URL}/internal/stats`);
    
    // Get users count
    const usersResponse = await axios.get(`${env.USER_SERVICE_URL}/internal/stats`);
    
    // Get attendance stats
    const attendanceResponse = await axios.get(`${env.ATTENDANCE_SERVICE_URL}/internal/stats`);
    
    // Get fee stats
    const feeResponse = await axios.get(`${env.FEE_SERVICE_URL}/internal/stats`);

    const dashboardStats = {
      totalSchools: schoolsResponse.data.data?.totalSchools || 0,
      totalStudents: usersResponse.data.data?.totalStudents || 0,
      totalTeachers: usersResponse.data.data?.totalTeachers || 0,
      totalParents: usersResponse.data.data?.totalParents || 0,
      todayAttendance: attendanceResponse.data.data?.todayAttendance || 0,
      totalRevenue: feeResponse.data.data?.totalRevenue || 0,
      pendingFees: feeResponse.data.data?.pendingFees || 0,
    };

    return ApiResponse.success(res, 200, dashboardStats, 'Dashboard stats retrieved successfully');
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch dashboard stats');
  }
});

export const getSchools = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${env.SCHOOL_SERVICE_URL}/internal/schools`);
    return ApiResponse.success(res, 200, response.data.data, 'Schools retrieved successfully');
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch schools');
  }
});

export const getUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  
  try {
    const response = await axios.get(`${env.USER_SERVICE_URL}/internal/users`, {
      params: { role }
    });
    return ApiResponse.success(res, 200, response.data.data, 'Users retrieved successfully');
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch users');
  }
});

export const getAcademicData = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${env.ACADEMIC_SERVICE_URL}/internal/stats`);
    return ApiResponse.success(res, 200, response.data.data, 'Academic data retrieved successfully');
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch academic data');
  }
});

export const getAttendanceData = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${env.ATTENDANCE_SERVICE_URL}/internal/stats`);
    return ApiResponse.success(res, 200, response.data.data, 'Attendance data retrieved successfully');
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch attendance data');
  }
});

export const getFeeData = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get(`${env.FEE_SERVICE_URL}/internal/stats`);
    return ApiResponse.success(res, 200, response.data.data, 'Fee data retrieved successfully');
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch fee data');
  }
});
