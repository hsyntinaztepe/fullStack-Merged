cmake_minimum_required(VERSION 3.16)
project(DatalinkService LANGUAGES CXX)

# =========================
# Genel C++ ayarları
# =========================
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# =========================
# Derleyiciye özel ayarlar
# =========================
if(MINGW)
    # Statik linkleme kaldırıldı, sadece pipe bırakıldı
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pipe")
elseif(MSVC)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /MP")
endif()

# =========================
# gRPC / Protobuf / Abseil yolları
# =========================
set(CMAKE_PREFIX_PATH
    "C:/users/stj.htinaztepe/desktop/installpc_protobuf3203"  # Protobuf 3.20.3
    "C:/users/stj.htinaztepe/desktop/installpc"               # gRPC + Abseil
)

set(Protobuf_PROTOC_EXECUTABLE
    "C:/users/stj.htinaztepe/desktop/installpc_protobuf3203/bin/protoc.exe"
)

find_package(Protobuf REQUIRED)
find_package(gRPC CONFIG REQUIRED)
find_package(absl CONFIG REQUIRED)

# =========================
# MongoDB C++ ve C Driver yolları
# =========================
set(MONGO_CXX_INCLUDE_DIR "C:/msys64/home/stj.htinaztepe/mongo-cxx-install/include")
set(MONGO_C_INCLUDE_DIR   "C:/msys64/home/stj.htinaztepe/mongo-c-driver-install/include")
set(MONGO_CXX_LIB_DIR     "C:/msys64/home/stj.htinaztepe/mongo-cxx-install/lib")
set(MONGO_C_LIB_DIR       "C:/msys64/home/stj.htinaztepe/mongo-c-driver-install/lib")

# =========================
# Kaynak dosyalar
# =========================
set(SRC_FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/main.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/datalinkservice.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/generated/datalink.pb.cc
    ${CMAKE_CURRENT_SOURCE_DIR}/generated/datalink.grpc.pb.cc
)

add_executable(datalink ${SRC_FILES})

# =========================
# Include dizinleri
# =========================
target_include_directories(datalink PRIVATE
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
target_link_directories(datalink PRIVATE
    ${MONGO_CXX_LIB_DIR}
    ${MONGO_C_LIB_DIR}
)

target_compile_definitions(datalink PRIVATE
    MONGOCXX_STATIC
    BSONCXX_STATIC
    MONGOC_STATIC
    BSON_STATIC
)

target_link_libraries(datalink PRIVATE
    gRPC::grpc++
    gRPC::grpc++_reflection
    protobuf::libprotobuf
    absl::strings
    absl::base

    mongocxx-static
    bsoncxx-static
    mongoc-2.0
    bson-2.0
    zstd
    z
)

if(MINGW)
    target_link_libraries(datalink PRIVATE
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
# Ninja optimizasyonları
# =========================
if(CMAKE_GENERATOR STREQUAL "Ninja")
    set(CMAKE_VERBOSE_MAKEFILE ON CACHE BOOL "Verbose output" FORCE)
    include(ProcessorCount)
    ProcessorCount(N)
    if(NOT N EQUAL 0)
        set(CMAKE_BUILD_PARALLEL_LEVEL ${N})
    endif()
endif()

# =========================
# Build tipine göre ayarlar
# =========================
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_definitions(datalink PRIVATE DEBUG=1)
    if(MINGW)
        set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    endif()
elseif(CMAKE_BUILD_TYPE STREQUAL "Release")
    if(MINGW)
        set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O2 -DNDEBUG")
    endif()
endif()

# =========================
# Install
# =========================
install(TARGETS datalink
    RUNTIME DESTINATION bin
)
