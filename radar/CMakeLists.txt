cmake_minimum_required(VERSION 3.16)
project(DataLinkService LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# =========================
# Derleyici ayarları
# =========================
if(MINGW)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -static-libgcc -static-libstdc++ -pipe")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -static")
elseif(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /MP")
endif()

# =========================
# gRPC / Protobuf / Abseil
# =========================
set(CMAKE_PREFIX_PATH
    "C:/Users/stj.nalbayrak/Documents/grpc-install"
)

set(Protobuf_PROTOC_EXECUTABLE
    "C:/Users/stj.nalbayrak/Documents/grpc-install/bin/protoc.exe"
)

find_package(Protobuf REQUIRED)
find_package(gRPC CONFIG REQUIRED)
find_package(absl CONFIG REQUIRED)

# =========================
# MongoDB C++ ve C Driver yolları
# =========================
set(MONGO_CXX_INCLUDE_DIR "C:/msys64/home/stj.nalbayrak/mongo-cxx-install/include")
set(MONGO_C_INCLUDE_DIR   "C:/msys64/home/stj.nalbayrak/mongo-c-driver-install/include")
set(MONGO_CXX_LIB_DIR     "C:/msys64/home/stj.nalbayrak/mongo-cxx-install/lib")
set(MONGO_C_LIB_DIR       "C:/msys64/home/stj.nalbayrak/mongo-c-driver-install/lib")

# =========================
# Kaynak dosyalar
# =========================
set(SRC_FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/main.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/radarservice.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/generated/radar.pb.cc
    ${CMAKE_CURRENT_SOURCE_DIR}/generated/radar.grpc.pb.cc
)

add_executable(radar ${SRC_FILES})

# =========================
# Include dizinleri
# =========================
target_include_directories(radar PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/proto
    ${CMAKE_CURRENT_SOURCE_DIR}/generated
    ${Protobuf_INCLUDE_DIRS}

    ${MONGO_CXX_INCLUDE_DIR}
    ${MONGO_CXX_INCLUDE_DIR}/mongocxx/v1
    ${MONGO_CXX_INCLUDE_DIR}/mongocxx/v_noabi
    ${MONGO_CXX_INCLUDE_DIR}/bsoncxx/v1
    ${MONGO_CXX_INCLUDE_DIR}/bsoncxx/v_noabi

    ${MONGO_C_INCLUDE_DIR}/mongoc-2.2.0
    ${MONGO_C_INCLUDE_DIR}/bson-2.2.0
)

# =========================
# Linkleme
# =========================
target_link_directories(radar PRIVATE
    ${MONGO_CXX_LIB_DIR}
    ${MONGO_C_LIB_DIR}
    C:/msys64/mingw64/lib
)


target_compile_definitions(radar PRIVATE
    MONGOCXX_STATIC
    BSONCXX_STATIC
    MONGOC_STATIC
    BSON_STATIC
)

target_link_libraries(radar PRIVATE
    gRPC::grpc++
    gRPC::grpc++_reflection
    protobuf::libprotobuf
    absl::strings
    absl::base

    mongocxx-static
    bsoncxx-static
    mongoc2
    bson2
    zstd
    z
)


if(MINGW)
    target_link_libraries(radar PRIVATE
        ws2_32
        secur32
        crypt32
        bcrypt
        ncrypt
        dnsapi
        advapi32
        kernel32
        user32
    )
endif()

# =========================
# Build tipine göre ayarlar
# =========================
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_definitions(radar PRIVATE DEBUG=1)
    if(MINGW)
        set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    endif()
elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MINGW)
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -DNDEBUG")
    endif()
endif()

install(TARGETS radar
    RUNTIME DESTINATION bin
)
